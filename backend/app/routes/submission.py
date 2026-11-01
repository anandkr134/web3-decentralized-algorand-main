import base64
import hashlib

from fastapi import APIRouter, HTTPException, Depends
from app.ai_validation import (
    create_or_update_submission_ai_review,
    get_ai_reviews_by_submission_ids,
    refresh_submission_ai_review,
)
from app.dao_governance import is_juror
from app.schemas import SubmissionCreate, SubmissionResponse, SubmissionReviewRefresh
from typing import List, Optional
from app.db import supabase
from app.algorand import algod_call_with_retry, algod_client
from app.auth import get_current_user, get_optional_current_user
from app.bounty_status import sync_bounty_state
from app.contract_escrow import get_contract_submission_hash
from algosdk.abi import ABIType, Method
from app.time_utils import parse_deadline, utc_now

router = APIRouter()
SUBMIT_WORK_SELECTOR = Method.from_signature("submit_work(byte[])void").get_selector()


def bounty_submission_proof_hash(description: str, proof_link: str) -> bytes:
    payload = f"description:{description.strip()}\nproofLink:{proof_link.strip()}".encode("utf-8")
    return hashlib.sha256(payload).digest()


def decode_arc4_dynamic_bytes_arg(arg: bytes) -> bytes:
    try:
        decoded = ABIType.from_string("byte[]").decode(arg)
        return bytes(decoded)
    except Exception:
        return arg


@router.post("/submit")
def submit_work(payload: SubmissionCreate, current_user: str = Depends(get_current_user)):
    try:
        bounty_id = payload.bountyId
        submitter = current_user
        description = payload.description.strip()
        proof_link = payload.proofLink.strip()
        tx_id = payload.txId

        # Check if bounty is open in Supabase
        res = (
            supabase.table('bounties')
            .select('id, title, description, reward, deadline, creator, escrowMode, contractAppId')
            .eq('id', bounty_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=400, detail="Bounty is not active or does not exist")

        bounty = sync_bounty_state(res.data[0])
        if bounty.get('status') != 'open':
            raise HTTPException(status_code=400, detail="Bounty is not active or does not exist")
        deadline = bounty.get('deadline')
        try:
            deadline_dt = parse_deadline(deadline) if deadline else None
        except ValueError as exc:
            raise HTTPException(status_code=500, detail="Stored bounty deadline is invalid") from exc

        if deadline_dt and deadline_dt < utc_now():
            raise HTTPException(status_code=400, detail="Bounty deadline has already passed")

        if bounty.get('creator') == submitter:
            raise HTTPException(status_code=400, detail="Bounty creators cannot submit to their own bounty")

        # Check for duplicates
        existing = supabase.table('submissions').select('id').eq('bountyId', bounty_id).eq('submitter', submitter).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="You have already submitted work for this bounty.")

        if bounty.get("escrowMode") == "contract":
            contract_app_id = bounty.get("contractAppId")
            if not contract_app_id:
                raise HTTPException(status_code=500, detail="Contract-backed bounty is missing its contractAppId")
            expected_hash = bounty_submission_proof_hash(description, proof_link)

            if not tx_id:
                on_chain_hash = get_contract_submission_hash(int(contract_app_id), submitter)
                if on_chain_hash and on_chain_hash != expected_hash:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "This wallet already has an on-chain submission for the bounty, "
                            "but the stored submission hash does not match the description and proof link you just entered. "
                            "Reuse the exact same description and proof link from the original submission, or use a fresh freelancer wallet."
                        ),
                    )
                if on_chain_hash != expected_hash:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Contract-backed submissions must include the Algorand app-call transaction ID, "
                            "or an existing on-chain submission with the same description and proof link."
                        ),
                    )
            else:
                txn = algod_call_with_retry(
                    "loading contract submission transaction details",
                    lambda: algod_client.pending_transaction_info(tx_id),
                )
                if not txn:
                    raise HTTPException(status_code=404, detail="Submission transaction was not found on Algorand")
                if txn.get("pool-error"):
                    raise HTTPException(status_code=400, detail=f"Submission transaction was rejected: {txn['pool-error']}")
                if not txn.get("confirmed-round"):
                    raise HTTPException(status_code=400, detail="Submission transaction is not confirmed yet")

                txn_payload = ((txn.get("txn") or {}).get("txn")) or {}
                application_txn = txn.get("application-transaction") or {}
                tx_type = txn.get("tx-type") or txn_payload.get("type")
                sender = txn.get("sender") or txn_payload.get("snd")
                app_id = application_txn.get("application-id") or txn_payload.get("apid")
                app_args = [
                    base64.b64decode(arg) if isinstance(arg, str) else bytes(arg)
                    for arg in (application_txn.get("application-args") or txn_payload.get("apaa") or [])
                ]

                if tx_type != "appl":
                    raise HTTPException(status_code=400, detail="Submission transaction must be an application call")
                if sender != submitter:
                    raise HTTPException(status_code=400, detail="Submission transaction sender does not match the authenticated wallet")
                if int(app_id or 0) != int(contract_app_id):
                    raise HTTPException(status_code=400, detail="Submission transaction does not target this bounty contract")
                if not app_args or app_args[0] != SUBMIT_WORK_SELECTOR:
                    raise HTTPException(status_code=400, detail="Submission transaction did not call submit_work")
                submitted_hash = decode_arc4_dynamic_bytes_arg(app_args[1]) if len(app_args) >= 2 else b""
                if len(app_args) < 2 or submitted_hash != expected_hash:
                    raise HTTPException(status_code=400, detail="Submission proof hash does not match the provided description and proof link")

        # Save submission to Supabase
        res = supabase.table('submissions').insert({
            'bountyId': bounty_id,
            'submitter': submitter,
            'description': description,
            'proofLink': proof_link,
            'status': 'pending'
        }).execute()

        if not res.data:
            raise Exception("Failed to insert submission")

        submission_row = res.data[0]
        ai_review = create_or_update_submission_ai_review(bounty, submission_row)

        return {"success": True, "submissionId": submission_row['id'], "aiReview": ai_review}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get")
def get_submissions(
    bountyId: Optional[str] = None,
    submitter: Optional[str] = None,
    current_user: str | None = Depends(get_optional_current_user),
):
    try:
        query = supabase.table('submissions').select('*')
        
        if bountyId:
            query = query.eq('bountyId', bountyId)
        elif submitter:
            if current_user != submitter:
                raise HTTPException(
                    status_code=403,
                    detail="Submission history is private. Authenticate as the submitter to view it.",
                )
            query = query.eq('submitter', submitter)
        else:
            raise HTTPException(status_code=400, detail="Provide bountyId or submitter")
            
        res = query.order('submittedAt', desc=True).execute()
        submissions = res.data or []
        ai_reviews = get_ai_reviews_by_submission_ids([submission['id'] for submission in submissions])
        bounties_by_id: dict[str, dict] = {}

        for submission in submissions:
            if submission['id'] in ai_reviews:
                continue
            bounty_id = submission.get('bountyId')
            if not bounty_id:
                continue
            if bounty_id not in bounties_by_id:
                bounty_res = (
                    supabase.table('bounties')
                    .select('id, title, description, reward, deadline, creator, escrowMode, contractAppId')
                    .eq('id', bounty_id)
                    .limit(1)
                    .execute()
                )
                bounties_by_id[bounty_id] = bounty_res.data[0] if bounty_res.data else {}
            bounty = bounties_by_id[bounty_id]
            if bounty:
                ai_reviews[submission['id']] = create_or_update_submission_ai_review(bounty, submission)

        for submission in submissions:
            submission['aiReview'] = ai_reviews.get(submission['id'])
        return {"success": True, "data": submissions}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submission fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review")
def rerun_submission_ai_review(
    payload: SubmissionReviewRefresh,
    current_user: str = Depends(get_current_user),
):
    try:
        submission_res = (
            supabase.table('submissions')
            .select('*')
            .eq('id', payload.submissionId)
            .limit(1)
            .execute()
        )
        if not submission_res.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        submission = submission_res.data[0]
        bounty_res = (
            supabase.table('bounties')
            .select('id, creator, status')
            .eq('id', submission['bountyId'])
            .limit(1)
            .execute()
        )
        if not bounty_res.data:
            raise HTTPException(status_code=404, detail="Bounty not found")

        bounty = bounty_res.data[0]
        if current_user not in {submission['submitter'], bounty['creator']} and not is_juror(current_user):
            raise HTTPException(
                status_code=403,
                detail="Only the submitter, bounty creator, or a configured DAO juror can rerun AI validation",
            )

        ai_review = refresh_submission_ai_review(payload.submissionId)
        return {"success": True, "aiReview": ai_review}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submission AI review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
