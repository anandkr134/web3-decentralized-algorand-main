from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user, get_optional_current_user
from app.bounty_status import sync_bounty_state
from app.dao_governance import cast_juror_vote, get_dispute_case, serialize_dispute_case
from app.db import supabase
from app.schemas import DaoVoteCreate

router = APIRouter()


@router.get("/status")
def get_dispute_status(
    bountyId: str,
    current_user: str | None = Depends(get_optional_current_user),
):
    bounty_res = supabase.table("bounties").select("*").eq("id", bountyId).limit(1).execute()
    if not bounty_res.data:
        raise HTTPException(status_code=404, detail="Bounty not found")

    bounty = sync_bounty_state(bounty_res.data[0])
    case = get_dispute_case(bountyId)
    if not case:
        return {
            "success": True,
            "data": None,
        }

    return {
        "success": True,
        "data": serialize_dispute_case(case, bounty, current_user=current_user),
    }


@router.post("/vote")
def vote_on_dispute(payload: DaoVoteCreate, current_user: str = Depends(get_current_user)):
    bounty_res = supabase.table("bounties").select("*").eq("id", payload.bountyId).limit(1).execute()
    if not bounty_res.data:
        raise HTTPException(status_code=404, detail="Bounty not found")

    bounty = sync_bounty_state(bounty_res.data[0])
    result = cast_juror_vote(
        bounty=bounty,
        current_user=current_user,
        decision=payload.decision,
        submission_id=payload.submissionId,
    )
    return {
        "success": True,
        **result,
    }
