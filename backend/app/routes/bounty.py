import base64
import hashlib
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, HTTPException, Depends
from app.schemas import BountyCreate, BountyCreateResponse, BountyConfirm, BountyApprove, BountyDispute, BountyResponse
from typing import List, Optional
from app.db import supabase
from app.algorand import algod_call_with_retry, algod_client
from app.auth import get_current_user
from app.bounty_status import count_bounty_submissions, sync_bounty_state
from app.contract_escrow import (
    deploy_and_bootstrap_bounty_contract,
    get_contract_state,
    is_contract_escrow_enabled,
    required_contract_funding_microalgos,
)
from app.dao_governance import ensure_dispute_case
from app.crypto import encrypt_private_key, decrypt_private_key
from algosdk import account, transaction, encoding
from algosdk.abi import Method
from app.time_utils import parse_deadline, utc_now

router = APIRouter()
ALGORAND_MIN_TXN_FEE_MICROALGOS = 1_000
FUND_BOUNTY_SELECTOR = Method.from_signature("fund_bounty(pay)void").get_selector()
APPROVE_WINNER_SELECTOR = Method.from_signature("approve_winner(address)void").get_selector()
MARK_DISPUTED_SELECTOR = Method.from_signature("mark_disputed()void").get_selector()


def microalgos_to_algo(amount: int) -> float:
    return amount / 1_000_000


def algo_to_microalgos(amount: Decimal | float | str) -> int:
    try:
        normalized = Decimal(str(amount))
    except InvalidOperation as exc:
        raise HTTPException(status_code=400, detail="Invalid ALGO amount") from exc

    if normalized <= 0:
        raise HTTPException(status_code=400, detail="Reward must be greater than zero")

    try:
        return int((normalized * Decimal("1000000")).to_integral_exact())
    except InvalidOperation as exc:
        raise HTTPException(
            status_code=400,
            detail="Reward must use at most 6 decimal places",
        ) from exc


def required_escrow_funding_microalgos(reward_amount: Decimal | float | str) -> int:
    reward_microalgos = algo_to_microalgos(reward_amount)
    return reward_microalgos + ALGORAND_MIN_TXN_FEE_MICROALGOS


def bounty_submission_proof_hash(description: str, proof_link: str) -> bytes:
    payload = f"description:{description.strip()}\nproofLink:{proof_link.strip()}".encode("utf-8")
    return hashlib.sha256(payload).digest()


def decode_app_args(raw_args: list | None) -> list[bytes]:
    return [base64.b64decode(arg) if isinstance(arg, str) else bytes(arg) for arg in (raw_args or [])]


def load_confirmed_transaction(tx_id: str, operation_label: str) -> dict:
    txn = algod_call_with_retry(
        operation_label,
        lambda: algod_client.pending_transaction_info(tx_id),
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction was not found on Algorand")
    if txn.get("pool-error"):
        raise HTTPException(status_code=400, detail=f"Transaction was rejected: {txn['pool-error']}")
    if not txn.get("confirmed-round"):
        raise HTTPException(status_code=400, detail="Transaction is not confirmed yet")
    return txn


def extract_transaction_payload(txn_info: dict) -> tuple[dict, dict]:
    txn_payload = ((txn_info.get("txn") or {}).get("txn")) or {}
    application_txn = txn_info.get("application-transaction") or {}
    return txn_payload, application_txn


@router.post("/create", response_model=BountyCreateResponse)
def create_bounty(bounty_data: BountyCreate, current_user: str = Depends(get_current_user)):
    try:
        title = bounty_data.title.strip()
        description = bounty_data.description.strip()
        reward = Decimal(str(bounty_data.reward))
        deadline = bounty_data.deadline
        # Use authenticated wallet address as creator
        creator = current_user

        reward_microalgos = algo_to_microalgos(reward)

        try:
            deadline_dt = parse_deadline(deadline)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Deadline must be a valid ISO-8601 date") from exc
        if deadline_dt <= utc_now():
            raise HTTPException(status_code=400, detail="Deadline must be in the future")

        contract_deployment = None
        if is_contract_escrow_enabled():
            contract_deployment = deploy_and_bootstrap_bounty_contract(
                creator_address=creator,
                reward_microalgos=reward_microalgos,
                deadline_unix=int(deadline_dt.timestamp()),
            )
            escrow_address = contract_deployment.app_address
            escrow_secret_encrypted = "CONTRACT_MANAGED"
            escrow_mode = "contract"
            funding_microalgos = required_contract_funding_microalgos(reward_microalgos)
            payout_fee_buffer_microalgos = funding_microalgos - reward_microalgos
        else:
            # Generate Escrow using Py-Algorand-SDK
            private_key, escrow_address = account.generate_account()
            # Encrypt the private key before storing
            escrow_secret_encrypted = encrypt_private_key(private_key)
            escrow_mode = "account"
            funding_microalgos = required_escrow_funding_microalgos(reward)
            payout_fee_buffer_microalgos = ALGORAND_MIN_TXN_FEE_MICROALGOS
        
        # Save to Supabase
        bounty_row = {
            'title': title,
            'description': description,
            'reward': str(reward),
            'deadline': deadline_dt.isoformat(),
            'creator': creator,
            'escrowAddress': escrow_address,
            'escrowSecret': escrow_secret_encrypted,
            'status': 'pending_funding',
            'escrowMode': escrow_mode,
        }

        if contract_deployment:
            bounty_row.update(
                {
                    'contractAppId': contract_deployment.app_id,
                    'contractDeploymentTxId': contract_deployment.deployment_tx_id,
                    'contractBootstrapTxId': contract_deployment.bootstrap_tx_id,
                }
            )

        try:
            res = supabase.table('bounties').insert(bounty_row).execute()
        except Exception as exc:
            if contract_deployment:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Contract-backed bounty creation requires the Supabase contract bounty fields migration. "
                        "Apply the SQL in `supabase/migrations/20260403_contract_bounty_fields.sql` first."
                    ),
                ) from exc
            raise

        if not res.data:
            raise Exception("Failed to insert bounty into database")

        response_payload = {
            "success": True,
            "bountyId": res.data[0]['id'],
            "escrowAddress": escrow_address,
            "reward": float(reward),
            "rewardMicroalgos": reward_microalgos,
            "requiredFundingAmount": microalgos_to_algo(funding_microalgos),
            "requiredFundingMicroalgos": funding_microalgos,
            "payoutFeeBufferAmount": microalgos_to_algo(payout_fee_buffer_microalgos),
            "payoutFeeBufferMicroalgos": payout_fee_buffer_microalgos,
            "escrowMode": escrow_mode,
        }
        if contract_deployment:
            response_payload.update(
                {
                    "contractAppId": contract_deployment.app_id,
                    "contractDeploymentTxId": contract_deployment.deployment_tx_id,
                    "contractBootstrapTxId": contract_deployment.bootstrap_tx_id,
                }
            )
        return response_payload
    except HTTPException:
        raise
    except Exception as e:
        print(f"Bounty creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/confirm")
def confirm_bounty(data: BountyConfirm, current_user: str = Depends(get_current_user)):
    try:
        bounty_id = data.bountyId
        tx_id = data.txId
        
        if not bounty_id or not tx_id:
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        # Fetch bounty to verify creator
        res = supabase.table('bounties').select('*').eq('id', bounty_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Bounty not found")
        
        bounty = res.data[0]
        if bounty.get('status') != 'pending_funding':
            raise HTTPException(status_code=400, detail="Bounty is not waiting for funding")

        if bounty.get('creator') != current_user:
            raise HTTPException(status_code=403, detail="Only the bounty creator can confirm funding")

        existing_tx = supabase.table('bounties').select('id').eq('fundingTxId', tx_id).neq('id', bounty_id).execute()
        if existing_tx.data:
            raise HTTPException(status_code=400, detail="This funding transaction is already linked to another bounty")

        pending_txn = load_confirmed_transaction(tx_id, "loading funding transaction details")

        txn_payload = ((pending_txn.get('txn') or {}).get('txn')) or {}
        tx_type = pending_txn.get('tx-type') or txn_payload.get('type')
        sender = pending_txn.get('sender') or txn_payload.get('snd')
        receiver = (
            ((pending_txn.get('payment-transaction') or {}).get('receiver'))
            or txn_payload.get('rcv')
        )
        amount = (
            ((pending_txn.get('payment-transaction') or {}).get('amount'))
            or txn_payload.get('amt')
        )

        if tx_type != 'pay':
            raise HTTPException(status_code=400, detail="Funding transaction must be a payment transaction")

        if sender != current_user:
            raise HTTPException(status_code=400, detail="Funding transaction sender does not match the authenticated creator")

        if receiver != bounty.get('escrowAddress'):
            raise HTTPException(status_code=400, detail="Funding transaction receiver does not match this bounty escrow address")

        escrow_mode = bounty.get("escrowMode") or "account"
        if escrow_mode == "contract":
            contract_app_id = bounty.get("contractAppId")
            if not contract_app_id:
                raise HTTPException(status_code=500, detail="Contract-backed bounty is missing its contractAppId")
            contract_state = get_contract_state(int(contract_app_id))
            if contract_state.get("status") != "open":
                raise HTTPException(
                    status_code=400,
                    detail="Funding payment landed, but the contract is still waiting for the grouped fund_bounty app call.",
                )
            expected_amount = required_contract_funding_microalgos(algo_to_microalgos(bounty.get("reward")))
        else:
            expected_amount = required_escrow_funding_microalgos(bounty.get('reward'))
        escrow_balance = algod_call_with_retry(
            "loading escrow account balance",
            lambda: algod_client.account_info(bounty.get('escrowAddress')),
        ).get('amount', 0)
        if amount != expected_amount and escrow_balance < expected_amount:
            shortfall = expected_amount - escrow_balance
            raise HTTPException(
                status_code=400,
                detail=(
                    "Escrow is still underfunded. It currently holds "
                    f"{escrow_balance} microALGO and needs {expected_amount} microALGO. "
                    f"Top up {shortfall} more microALGO and retry confirmation."
                )
            )
        
        supabase.table('bounties').update({
            'status': 'open',
            'fundingTxId': tx_id
        }).eq('id', bounty_id).execute()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Bounty confirm error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get")
def get_bounty(id: Optional[str] = None, creator: Optional[str] = None):
    try:
        if id:
            res = supabase.table('bounties').select('*').eq('id', id).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Bounty not found")
                
            data = sync_bounty_state(res.data[0])
            # Strip secret key!
            if 'escrowSecret' in data:
                del data['escrowSecret']
            
            return {"success": True, "data": data}
            
        elif creator:
            raise HTTPException(
                status_code=403,
                detail="Creator bounty history is not public. Use /api/dashboard/my-bounties with authentication."
            )
            
        else:
            # Get all open
            res = supabase.table('bounties').select('*').eq('status', 'open').order('createdAt', desc=True).execute()
            bounties = []
            for bounty in res.data:
                synced_bounty = sync_bounty_state(bounty)
                if synced_bounty.get('status') != 'open':
                    continue
                bounties.append(synced_bounty)
            for bounty in bounties:
                if 'escrowSecret' in bounty:
                    del bounty['escrowSecret']
                
            return {"success": True, "data": bounties}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Bounty get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve")
def approve_bounty(data: BountyApprove, current_user: str = Depends(get_current_user)):
    try:
        bounty_id = data.bountyId
        submission_id = data.submissionId
        winner_address = data.winnerAddress
        approval_tx_id = data.txId
        creator_address = current_user

        if not encoding.is_valid_address(winner_address):
            raise HTTPException(status_code=400, detail="Winner address is not a valid Algorand address")

        # 1. Fetch Bounty
        res = supabase.table('bounties').select('*').eq('id', bounty_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Bounty not found")
            
        bounty = res.data[0]
        
        bounty = sync_bounty_state(bounty)

        if bounty.get('creator') != creator_address:
            raise HTTPException(status_code=403, detail="Only creator can approve")

        submission_res = supabase.table('submissions').select('*').eq('id', submission_id).execute()
        if not submission_res.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        submission = submission_res.data[0]
        if submission.get('bountyId') != bounty_id:
            raise HTTPException(status_code=400, detail="Submission does not belong to this bounty")

        if submission.get('submitter') != winner_address:
            raise HTTPException(status_code=400, detail="Winner address does not match the submission owner")

        # 2. Decrypt escrow private key
        escrow_mode = bounty.get('escrowMode') or 'account'
        escrow_secret_encrypted = bounty.get('escrowSecret')
        escrow_address = bounty.get('escrowAddress')
        reward = bounty.get('reward')

        if escrow_mode == 'contract' or escrow_secret_encrypted == 'CONTRACT_MANAGED':
            if not approval_tx_id:
                raise HTTPException(status_code=400, detail="Contract-backed approvals must include the Algorand app-call transaction ID")
            contract_app_id = bounty.get("contractAppId")
            if not contract_app_id:
                raise HTTPException(status_code=500, detail="Contract-backed bounty is missing its contractAppId")

            approval_txn = load_confirmed_transaction(approval_tx_id, "loading contract approval transaction details")
            txn_payload, application_txn = extract_transaction_payload(approval_txn)
            tx_type = approval_txn.get("tx-type") or txn_payload.get("type")
            sender = approval_txn.get("sender") or txn_payload.get("snd")
            app_id = application_txn.get("application-id") or txn_payload.get("apid")
            app_args = decode_app_args(application_txn.get("application-args") or txn_payload.get("apaa"))

            if tx_type != "appl":
                raise HTTPException(status_code=400, detail="Approval transaction must be an application call")
            if sender != creator_address:
                raise HTTPException(status_code=400, detail="Approval transaction sender does not match the authenticated creator")
            if int(app_id or 0) != int(contract_app_id):
                raise HTTPException(status_code=400, detail="Approval transaction does not target this bounty contract")
            if not app_args or app_args[0] != APPROVE_WINNER_SELECTOR:
                raise HTTPException(status_code=400, detail="Approval transaction did not call approve_winner")
            if len(app_args) < 2 or app_args[1] != encoding.decode_address(winner_address):
                raise HTTPException(status_code=400, detail="Approval transaction winner does not match the selected submission")

            if (
                bounty.get('status') == 'completed'
                and bounty.get('winner') == winner_address
                and bounty.get('winnerSubmissionId') == submission_id
            ):
                payout_tx_id = bounty.get('payoutTxId') or approval_tx_id
                return {
                    "success": True,
                    "txId": payout_tx_id,
                    "message": "Winner was already approved on-chain and synced.",
                }

            payout_tx_id = approval_tx_id
            inner_txns = approval_txn.get("inner-txns") or []
            if inner_txns:
                payout_tx_id = inner_txns[0].get("txid") or payout_tx_id

            supabase.table('bounties').update({
                'status': 'completed',
                'winner': winner_address,
                'winnerSubmissionId': submission_id,
                'payoutTxId': payout_tx_id
            }).eq('id', bounty_id).execute()

            supabase.table('submissions').update({'status': 'approved'}).eq('id', submission_id).execute()
            supabase.table('submissions').update({'status': 'rejected'}).eq('bountyId', bounty_id).eq('status', 'pending').neq('id', submission_id).execute()

            return {"success": True, "txId": payout_tx_id, "message": "Winner approved on-chain and payout released from the bounty contract."}

        if bounty.get('status') not in {'open', 'under_review'}:
            raise HTTPException(status_code=400, detail="Bounty is not in a reviewable state")

        if submission.get('status') != 'pending':
            raise HTTPException(status_code=400, detail="Submission has already been reviewed")

        private_key = decrypt_private_key(escrow_secret_encrypted)
        
        # 3. Construct Algorand Payout Transaction
        params = algod_client.suggested_params()
        params.flat_fee = True
        params.fee = ALGORAND_MIN_TXN_FEE_MICROALGOS
        reward_micro_algo = algo_to_microalgos(reward)
        
        unsigned_txn = transaction.PaymentTxn(
            sender=escrow_address,
            sp=params,
            receiver=winner_address,
            amt=reward_micro_algo,
            close_remainder_to=creator_address
        )
        
        # Sign and Send
        signed_txn = unsigned_txn.sign(private_key)
        tx_id = algod_client.send_transaction(signed_txn)
        transaction.wait_for_confirmation(algod_client, tx_id, 5)
        
        # 4. Update Database
        supabase.table('bounties').update({
            'status': 'completed',
            'winner': winner_address,
            'winnerSubmissionId': submission_id,
            'payoutTxId': tx_id
        }).eq('id', bounty_id).execute()
        
        # Mark Submission as approved
        supabase.table('submissions').update({'status': 'approved'}).eq('id', submission_id).execute()
        
        # Reject others
        supabase.table('submissions').update({'status': 'rejected'}).eq('bountyId', bounty_id).eq('status', 'pending').neq('id', submission_id).execute()
                
        return {"success": True, "txId": tx_id}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Approve error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dispute")
def dispute_bounty(data: BountyDispute, current_user: str = Depends(get_current_user)):
    try:
        bounty_id = data.bountyId
        dispute_tx_id = data.txId

        res = supabase.table('bounties').select('*').eq('id', bounty_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Bounty not found")

        bounty = sync_bounty_state(res.data[0])
        if bounty.get('creator') != current_user:
            raise HTTPException(status_code=403, detail="Only creator can dispute")

        if bounty.get('status') != 'under_review':
            raise HTTPException(
                status_code=400,
                detail="Only review-stage bounties can be marked disputed",
            )

        if count_bounty_submissions(bounty_id) == 0:
            raise HTTPException(status_code=400, detail="Cannot dispute a bounty with no submissions")

        if bounty.get("escrowMode") == "contract":
            if not dispute_tx_id:
                raise HTTPException(status_code=400, detail="Contract-backed disputes must include the Algorand app-call transaction ID")
            contract_app_id = bounty.get("contractAppId")
            if not contract_app_id:
                raise HTTPException(status_code=500, detail="Contract-backed bounty is missing its contractAppId")

            dispute_txn = load_confirmed_transaction(dispute_tx_id, "loading contract dispute transaction details")
            txn_payload, application_txn = extract_transaction_payload(dispute_txn)
            tx_type = dispute_txn.get("tx-type") or txn_payload.get("type")
            sender = dispute_txn.get("sender") or txn_payload.get("snd")
            app_id = application_txn.get("application-id") or txn_payload.get("apid")
            app_args = decode_app_args(application_txn.get("application-args") or txn_payload.get("apaa"))

            if tx_type != "appl":
                raise HTTPException(status_code=400, detail="Dispute transaction must be an application call")
            if sender != current_user:
                raise HTTPException(status_code=400, detail="Dispute transaction sender does not match the authenticated creator")
            if int(app_id or 0) != int(contract_app_id):
                raise HTTPException(status_code=400, detail="Dispute transaction does not target this bounty contract")
            if not app_args or app_args[0] != MARK_DISPUTED_SELECTOR:
                raise HTTPException(status_code=400, detail="Dispute transaction did not call mark_disputed")

        supabase.table('bounties').update({'status': 'disputed'}).eq('id', bounty_id).execute()
        ensure_dispute_case(bounty, current_user)
        return {
            "success": True,
            "message": "Bounty moved to disputed review. The DAO juror case is now open while escrow stays locked.",
        }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Dispute error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
