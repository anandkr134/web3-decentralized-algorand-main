import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required but was not set.")
    return value


def _csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


API_ENV = os.getenv("API_ENV", "development").strip().lower()
API_HOST = os.getenv("API_HOST", "127.0.0.1").strip()
API_PORT = int(os.getenv("API_PORT", "8000"))

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").strip()
API_BASE_URL = os.getenv("API_BASE_URL", f"http://{API_HOST}:{API_PORT}").strip()

CORS_ORIGINS = _csv_env(
    "CORS_ORIGINS",
    [FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
)
TRUSTED_HOSTS = _csv_env(
    "TRUSTED_HOSTS",
    ["localhost", "127.0.0.1"],
)

SUPABASE_URL = _required_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    or _required_env("SUPABASE_KEY")
)

JWT_SECRET = _required_env("JWT_SECRET")
ESCROW_ENCRYPTION_KEY = _required_env("ESCROW_ENCRYPTION_KEY")

ALGOD_SERVER = os.getenv("ALGOD_SERVER", "https://testnet-api.algonode.cloud").strip()
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "").strip()
ALGOD_PORT = os.getenv("ALGOD_PORT", "443").strip()

NONCE_EXPIRY_SECONDS = int(os.getenv("NONCE_EXPIRY_SECONDS", "300"))
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").strip().lower() == "true"

CONTRACT_ESCROW_ENABLED = os.getenv("CONTRACT_ESCROW_ENABLED", "false").strip().lower() == "true"
CONTRACT_DEPLOYER_MNEMONIC = os.getenv("CONTRACT_DEPLOYER_MNEMONIC", "").strip()
CONTRACT_APPROVAL_TEAL_PATH = (
    os.getenv("CONTRACT_APPROVAL_TEAL_PATH", "").strip()
    or str(BACKEND_DIR / "contract_artifacts" / "BountyEscrowContract.approval.teal")
)
CONTRACT_CLEAR_TEAL_PATH = (
    os.getenv("CONTRACT_CLEAR_TEAL_PATH", "").strip()
    or str(BACKEND_DIR / "contract_artifacts" / "BountyEscrowContract.clear.teal")
)

DAO_JUROR_ADDRESSES = _csv_env("DAO_JUROR_ADDRESSES", [])
DAO_QUORUM = max(1, int(os.getenv("DAO_QUORUM", "2")))

AI_VALIDATION_ENABLED = os.getenv("AI_VALIDATION_ENABLED", "true").strip().lower() == "true"
AI_VALIDATION_PROVIDER = os.getenv("AI_VALIDATION_PROVIDER", "heuristic").strip().lower()
AI_VALIDATION_API_URL = os.getenv("AI_VALIDATION_API_URL", "https://api.openai.com/v1/chat/completions").strip()
AI_VALIDATION_API_KEY = os.getenv("AI_VALIDATION_API_KEY", "").strip()
AI_VALIDATION_MODEL = os.getenv("AI_VALIDATION_MODEL", "gpt-4o-mini").strip()
