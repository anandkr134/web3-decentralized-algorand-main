import time
import secrets
import base64
import hashlib
from hmac import compare_digest

import jwt
from algosdk import encoding
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import JWT_SECRET, NONCE_EXPIRY_SECONDS
from app.db import get_supabase

JWT_ALGORITHM = "HS256"
JWT_EXPIRY = 86400  # 24 hours

security = HTTPBearer(auto_error=False)


def _hash_nonce(nonce: str) -> str:
    return hashlib.sha256(nonce.encode("utf-8")).hexdigest()


def _delete_challenge(address: str) -> None:
    get_supabase().table("auth_challenges").delete().eq("address", address).execute()


def consume_challenge(address: str) -> None:
    _delete_challenge(address)


def _get_challenge(address: str) -> dict | None:
    response = (
        get_supabase()
        .table("auth_challenges")
        .select("*")
        .eq("address", address)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return response.data[0]


def create_challenge(address: str) -> str:
    """Generate a random challenge nonce for an address."""
    nonce = secrets.token_hex(16)
    expires_at = int(time.time() + NONCE_EXPIRY_SECONDS)

    get_supabase().table("auth_challenges").upsert(
        {
            "address": address,
            "nonceHash": _hash_nonce(nonce),
            "expiresAt": expires_at,
        }
    ).execute()

    return nonce


def verify_nonce(address: str, nonce: str) -> bool:
    """Check if the challenge nonce is valid and not expired."""
    challenge = _get_challenge(address)
    if not challenge:
        return False

    expires_at = int(challenge.get("expiresAt") or 0)

    if expires_at < int(time.time()):
        _delete_challenge(address)
        return False

    if not compare_digest(str(challenge.get("nonceHash") or ""), _hash_nonce(nonce)):
        return False

    return True


def verify_wallet_signature(address: str, nonce: str, signature_b64: str) -> bool:
    """Verify an ed25519 signature from Pera Wallet against an Algorand address."""
    try:
        signature = base64.b64decode(signature_b64)
        nonce_bytes = nonce.encode('utf-8')
        # Decode Algorand address to get 32-byte ed25519 public key
        public_key = encoding.decode_address(address)
        verify_key = VerifyKey(public_key)
        # Pera Wallet signData uses ARC-0008: signs "MX" + data
        try:
            verify_key.verify(b"MX" + nonce_bytes, signature)
            return True
        except BadSignatureError:
            # Fallback: try without prefix in case wallet doesn't use MX prefix
            verify_key.verify(nonce_bytes, signature)
            return True
    except (BadSignatureError, Exception):
        return False


def create_token(address: str) -> str:
    """Create a JWT token for an authenticated wallet address."""
    payload = {
        "sub": address,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency: extract and verify JWT, return wallet address.
    Raises 401 if no token or invalid token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        address = payload.get("sub")
        if not address:
            raise HTTPException(status_code=401, detail="Invalid token")
        return address
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str | None:
    """Best-effort JWT extraction for routes that are public by default."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        address = payload.get("sub")
        return address if address else None
    except jwt.InvalidTokenError:
        return None
