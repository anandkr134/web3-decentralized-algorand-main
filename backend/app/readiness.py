from app.algorand import algod_call_with_retry, algod_client
from app.db import get_supabase

REQUIRED_TABLES = (
    "bounties",
    "submissions",
    "auth_challenges",
    "dispute_cases",
    "dispute_votes",
    "ai_reviews",
)


def run_readiness_checks() -> dict:
    checks = {
        "supabase": {"ok": False},
        "algod": {"ok": False},
    }

    try:
        client = get_supabase()
        for table_name in REQUIRED_TABLES:
            client.table(table_name).select("*").limit(1).execute()
        checks["supabase"] = {
            "ok": True,
            "tables": list(REQUIRED_TABLES),
        }
    except Exception as exc:
        checks["supabase"] = {
            "ok": False,
            "error": str(exc),
        }

    try:
        algod_status = algod_call_with_retry(
            "checking Algod readiness",
            algod_client.status,
        )
        checks["algod"] = {
            "ok": True,
            "lastRound": algod_status.get("last-round"),
        }
    except Exception as exc:
        checks["algod"] = {
            "ok": False,
            "error": str(exc),
        }

    return checks
