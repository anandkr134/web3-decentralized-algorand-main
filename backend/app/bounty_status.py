from app.db import supabase
from app.contract_escrow import sync_contract_bounty_state
from app.time_utils import parse_deadline, utc_now


ACTIVE_BOUNTY_STATUSES = {"open"}
REVIEWABLE_BOUNTY_STATUSES = {"open", "under_review"}
TERMINAL_BOUNTY_STATUSES = {"completed", "disputed", "expired", "refunded"}


def _persist_bounty_state(bounty_id: str, update_fields: dict) -> None:
    try:
        supabase.table("bounties").update(update_fields).eq("id", bounty_id).execute()
    except Exception as exc:
        # Keep API reads alive even if the database status constraint is stale.
        print(f"Bounty state persistence warning for {bounty_id}: {exc}")


def count_bounty_submissions(bounty_id: str) -> int:
    response = (
        supabase.table("submissions")
        .select("id")
        .eq("bountyId", bounty_id)
        .execute()
    )
    return len(response.data or [])


def sync_bounty_state(bounty: dict) -> dict:
    if bounty.get("escrowMode") == "contract":
        try:
            synced_bounty = sync_contract_bounty_state(bounty)
        except Exception:
            return bounty

        status = synced_bounty.get("status")
        if status != bounty.get("status") or synced_bounty.get("winner") != bounty.get("winner"):
            update_fields = {"status": status}
            if synced_bounty.get("winner"):
                update_fields["winner"] = synced_bounty.get("winner")
            _persist_bounty_state(bounty.get("id"), update_fields)
        return synced_bounty

    status = bounty.get("status")
    bounty_id = bounty.get("id")
    deadline = bounty.get("deadline")

    if status != "open" or not bounty_id or not deadline:
        return bounty

    try:
        deadline_dt = parse_deadline(deadline)
    except ValueError:
        return bounty

    if deadline_dt >= utc_now():
        return bounty

    next_status = "under_review" if count_bounty_submissions(bounty_id) else "expired"

    if next_status == status:
        return bounty

    _persist_bounty_state(bounty_id, {"status": next_status})
    next_bounty = dict(bounty)
    next_bounty["status"] = next_status
    return next_bounty
