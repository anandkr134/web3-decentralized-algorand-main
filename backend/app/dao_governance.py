from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from algosdk import transaction
from fastapi import HTTPException

from app.algorand import algod_client
from app.config import DAO_JUROR_ADDRESSES, DAO_QUORUM
from app.crypto import decrypt_private_key
from app.db import supabase
from app.time_utils import utc_now

ALGORAND_MIN_TXN_FEE_MICROALGOS = 1_000
APPROVE_SUBMISSION_DECISION = "approve_submission"
REFUND_CREATOR_DECISION = "refund_creator"
SUPPORTED_DISPUTE_DECISIONS = {APPROVE_SUBMISSION_DECISION, REFUND_CREATOR_DECISION}
OPEN_CASE_STATUSES = {"open"}
TERMINAL_CASE_STATUSES = {"resolved", "manual_execution_required"}


@dataclass
class ResolutionResult:
    status: str
    message: str
    resolution_tx_id: str | None = None
    resolution_winner: str | None = None


def get_dao_jurors() -> list[str]:
    seen: set[str] = set()
    jurors: list[str] = []
    for address in DAO_JUROR_ADDRESSES:
        normalized = address.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            jurors.append(normalized)
    return jurors


def get_dao_quorum() -> int:
    juror_count = len(get_dao_jurors())
    if juror_count == 0:
        return DAO_QUORUM
    return max(1, min(DAO_QUORUM, juror_count))


def is_juror(address: str | None) -> bool:
    return bool(address and address in get_dao_jurors())


def _algo_to_microalgos(amount: Decimal | float | str) -> int:
    try:
        normalized = Decimal(str(amount))
    except InvalidOperation as exc:
        raise HTTPException(status_code=500, detail="Stored reward amount is invalid") from exc
    return int((normalized * Decimal("1000000")).to_integral_value())


def _get_case_votes(case_id: str) -> list[dict]:
    response = (
        supabase.table("dispute_votes")
        .select("*")
        .eq("caseId", case_id)
        .order("createdAt", desc=False)
        .execute()
    )
    return response.data or []


def get_dispute_case(bounty_id: str) -> dict | None:
    response = (
        supabase.table("dispute_cases")
        .select("*")
        .eq("bountyId", bounty_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return response.data[0]


def ensure_dispute_case(bounty: dict, created_by: str) -> dict:
    existing = get_dispute_case(str(bounty["id"]))
    if existing:
        return existing

    row = {
        "bountyId": bounty["id"],
        "status": "open",
        "quorum": get_dao_quorum(),
        "eligibleJurors": get_dao_jurors(),
        "createdBy": created_by,
    }
    response = supabase.table("dispute_cases").insert(row).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Unable to create the DAO dispute case")
    return response.data[0]


def _build_tallies(votes: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str | None], int] = Counter(
        (vote["decision"], vote.get("submissionId")) for vote in votes
    )
    tallies = [
        {
            "decision": decision,
            "submissionId": submission_id,
            "voteCount": vote_count,
        }
        for (decision, submission_id), vote_count in grouped.items()
    ]
    tallies.sort(key=lambda item: (-item["voteCount"], item["decision"], item.get("submissionId") or ""))
    return tallies


def serialize_dispute_case(case: dict, bounty: dict, current_user: str | None = None) -> dict:
    votes = _get_case_votes(case["id"])
    tallies = _build_tallies(votes)

    vote_submission_ids = [
        vote.get("submissionId")
        for vote in votes
        if vote.get("decision") == APPROVE_SUBMISSION_DECISION and vote.get("submissionId")
    ]
    resolution_submission_id = case.get("resolutionSubmissionId")
    if resolution_submission_id:
        vote_submission_ids.append(resolution_submission_id)

    submission_winners: dict[str, str] = {}
    for submission_id in {submission_id for submission_id in vote_submission_ids if submission_id}:
        submission_res = (
            supabase.table("submissions")
            .select("id, submitter")
            .eq("id", submission_id)
            .limit(1)
            .execute()
        )
        if submission_res.data:
            submission_winners[submission_id] = submission_res.data[0].get("submitter")

    for tally in tallies:
        submission_id = tally.get("submissionId")
        if submission_id:
            tally["winnerAddress"] = submission_winners.get(submission_id)

    current_vote = next((vote for vote in votes if current_user and vote.get("juror") == current_user), None)
    eligible_jurors = case.get("eligibleJurors") or []

    return {
        "id": case["id"],
        "bountyId": case["bountyId"],
        "status": case.get("status") or "open",
        "quorum": case.get("quorum") or get_dao_quorum(),
        "eligibleJurors": eligible_jurors,
        "isJuror": bool(current_user and current_user in eligible_jurors),
        "currentUserVote": current_vote,
        "voteCount": len(votes),
        "votes": votes,
        "tallies": tallies,
        "resolution": case.get("resolution"),
        "resolutionSubmissionId": case.get("resolutionSubmissionId"),
        "resolutionWinner": case.get("resolutionWinner") or submission_winners.get(case.get("resolutionSubmissionId")),
        "resolutionTxId": case.get("resolutionTxId"),
        "resolvedAt": case.get("resolvedAt"),
        "escrowMode": bounty.get("escrowMode") or "account",
    }


def _resolve_account_approval(bounty: dict, submission: dict) -> str:
    escrow_secret_encrypted = bounty.get("escrowSecret")
    if not escrow_secret_encrypted or escrow_secret_encrypted == "CONTRACT_MANAGED":
        raise HTTPException(status_code=500, detail="This bounty does not have an account-managed escrow secret")

    private_key = decrypt_private_key(escrow_secret_encrypted)
    params = algod_client.suggested_params()
    params.flat_fee = True
    params.fee = ALGORAND_MIN_TXN_FEE_MICROALGOS

    unsigned_txn = transaction.PaymentTxn(
        sender=bounty["escrowAddress"],
        sp=params,
        receiver=submission["submitter"],
        amt=_algo_to_microalgos(bounty["reward"]),
        close_remainder_to=bounty["creator"],
    )
    signed_txn = unsigned_txn.sign(private_key)
    tx_id = algod_client.send_transaction(signed_txn)
    transaction.wait_for_confirmation(algod_client, tx_id, 8)
    return tx_id


def _resolve_account_refund(bounty: dict) -> str:
    escrow_secret_encrypted = bounty.get("escrowSecret")
    if not escrow_secret_encrypted or escrow_secret_encrypted == "CONTRACT_MANAGED":
        raise HTTPException(status_code=500, detail="This bounty does not have an account-managed escrow secret")

    private_key = decrypt_private_key(escrow_secret_encrypted)
    params = algod_client.suggested_params()
    params.flat_fee = True
    params.fee = ALGORAND_MIN_TXN_FEE_MICROALGOS

    unsigned_txn = transaction.PaymentTxn(
        sender=bounty["escrowAddress"],
        sp=params,
        receiver=bounty["creator"],
        amt=0,
        close_remainder_to=bounty["creator"],
    )
    signed_txn = unsigned_txn.sign(private_key)
    tx_id = algod_client.send_transaction(signed_txn)
    transaction.wait_for_confirmation(algod_client, tx_id, 8)
    return tx_id


def _resolve_quorum(case: dict, bounty: dict, decision: str, submission_id: str | None) -> ResolutionResult:
    resolved_at = utc_now().isoformat()

    if bounty.get("escrowMode") == "contract":
        winner_address = None
        if decision == APPROVE_SUBMISSION_DECISION and submission_id:
            submission_res = (
                supabase.table("submissions")
                .select("id, submitter")
                .eq("id", submission_id)
                .limit(1)
                .execute()
            )
            if not submission_res.data:
                raise HTTPException(status_code=404, detail="Selected submission was not found")
            winner_address = submission_res.data[0].get("submitter")

        supabase.table("dispute_cases").update(
            {
                "status": "manual_execution_required",
                "resolution": decision,
                "resolutionSubmissionId": submission_id,
                "resolutionWinner": winner_address,
                "resolvedAt": resolved_at,
            }
        ).eq("id", case["id"]).execute()

        return ResolutionResult(
            status="manual_execution_required",
            message=(
                "Juror quorum reached. This contract-backed dispute now has a DAO verdict, "
                "but on-chain execution still needs the contract-aware settlement step."
            ),
            resolution_winner=winner_address,
        )

    if decision == APPROVE_SUBMISSION_DECISION:
        if not submission_id:
            raise HTTPException(status_code=400, detail="A submission must be selected for approval votes")
        submission_res = (
            supabase.table("submissions")
            .select("*")
            .eq("id", submission_id)
            .limit(1)
            .execute()
        )
        if not submission_res.data:
            raise HTTPException(status_code=404, detail="Selected submission was not found")
        submission = submission_res.data[0]
        if submission.get("bountyId") != bounty["id"]:
            raise HTTPException(status_code=400, detail="The selected submission does not belong to this bounty")

        tx_id = _resolve_account_approval(bounty, submission)
        supabase.table("bounties").update(
            {
                "status": "completed",
                "winner": submission["submitter"],
                "winnerSubmissionId": submission_id,
                "payoutTxId": tx_id,
            }
        ).eq("id", bounty["id"]).execute()
        supabase.table("submissions").update({"status": "approved"}).eq("id", submission_id).execute()
        (
            supabase.table("submissions")
            .update({"status": "rejected"})
            .eq("bountyId", bounty["id"])
            .eq("status", "pending")
            .neq("id", submission_id)
            .execute()
        )
        supabase.table("dispute_cases").update(
            {
                "status": "resolved",
                "resolution": decision,
                "resolutionSubmissionId": submission_id,
                "resolutionWinner": submission["submitter"],
                "resolutionTxId": tx_id,
                "resolvedAt": resolved_at,
            }
        ).eq("id", case["id"]).execute()
        return ResolutionResult(
            status="resolved",
            message="Juror quorum approved a freelancer submission and escrow was released.",
            resolution_tx_id=tx_id,
            resolution_winner=submission["submitter"],
        )

    tx_id = _resolve_account_refund(bounty)
    (
        supabase.table("submissions")
        .update({"status": "rejected"})
        .eq("bountyId", bounty["id"])
        .eq("status", "pending")
        .execute()
    )
    supabase.table("bounties").update(
        {
            "status": "refunded",
            "payoutTxId": tx_id,
        }
    ).eq("id", bounty["id"]).execute()
    supabase.table("dispute_cases").update(
        {
            "status": "resolved",
            "resolution": decision,
            "resolutionTxId": tx_id,
            "resolvedAt": resolved_at,
        }
    ).eq("id", case["id"]).execute()
    return ResolutionResult(
        status="resolved",
        message="Juror quorum refunded the creator and closed the escrow account.",
        resolution_tx_id=tx_id,
    )


def cast_juror_vote(
    bounty: dict,
    current_user: str,
    decision: str,
    submission_id: str | None = None,
) -> dict:
    if decision not in SUPPORTED_DISPUTE_DECISIONS:
        raise HTTPException(status_code=400, detail="Unsupported DAO vote decision")

    if not is_juror(current_user):
        raise HTTPException(status_code=403, detail="Only configured DAO jurors can vote on disputes")

    if bounty.get("status") != "disputed":
        raise HTTPException(status_code=400, detail="DAO voting is only available once a bounty is disputed")

    if decision == APPROVE_SUBMISSION_DECISION:
        if not submission_id:
            raise HTTPException(status_code=400, detail="Choose a submission to approve before voting")
        submission_res = (
            supabase.table("submissions")
            .select("id, bountyId, submitter, status")
            .eq("id", submission_id)
            .limit(1)
            .execute()
        )
        if not submission_res.data:
            raise HTTPException(status_code=404, detail="Selected submission was not found")
        submission = submission_res.data[0]
        if submission.get("bountyId") != bounty["id"]:
            raise HTTPException(status_code=400, detail="The selected submission does not belong to this bounty")
        if submission.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Only pending submissions can be voted through the DAO")

    case = ensure_dispute_case(bounty, bounty["creator"])
    if case.get("status") in TERMINAL_CASE_STATUSES:
        raise HTTPException(status_code=400, detail="This dispute has already reached a terminal DAO outcome")

    (
        supabase.table("dispute_votes")
        .delete()
        .eq("caseId", case["id"])
        .eq("juror", current_user)
        .execute()
    )
    insert_res = supabase.table("dispute_votes").insert(
        {
            "caseId": case["id"],
            "bountyId": bounty["id"],
            "juror": current_user,
            "decision": decision,
            "submissionId": submission_id,
        }
    ).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Unable to record the juror vote")

    votes = _get_case_votes(case["id"])
    tallies = _build_tallies(votes)
    quorum = int(case.get("quorum") or get_dao_quorum())

    quorum_candidates = [tally for tally in tallies if tally["voteCount"] >= quorum]
    resolution_message = "Vote recorded. Waiting for more juror votes."

    if len(quorum_candidates) == 1:
        top_choice = quorum_candidates[0]
        resolution = _resolve_quorum(
            case,
            bounty,
            top_choice["decision"],
            top_choice.get("submissionId"),
        )
        resolution_message = resolution.message
        case = get_dispute_case(str(bounty["id"])) or case
    elif len(quorum_candidates) > 1:
        resolution_message = "Vote recorded, but the DAO tally is tied. More juror votes are needed."

    return {
        "message": resolution_message,
        "disputeCase": serialize_dispute_case(case, bounty, current_user=current_user),
    }
