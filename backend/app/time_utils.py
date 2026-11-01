from datetime import datetime, time, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_deadline(deadline: str) -> datetime:
    normalized = deadline.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    parsed = datetime.fromisoformat(normalized)

    if "T" not in normalized:
        parsed = datetime.combine(parsed.date(), time(23, 59, 59), tzinfo=timezone.utc)
    elif parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)
