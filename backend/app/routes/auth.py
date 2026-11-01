from fastapi import APIRouter, HTTPException, Query
from app.auth import (
    consume_challenge,
    create_challenge,
    verify_nonce,
    verify_wallet_signature,
    create_token,
)
from pydantic import BaseModel
from algosdk import encoding

router = APIRouter()


class AuthVerifyRequest(BaseModel):
    address: str
    nonce: str
    signature: str  # base64-encoded ed25519 signature


@router.get("/challenge")
def get_challenge(address: str = Query(..., description="Algorand wallet address")):
    """Generate an authentication challenge nonce for the given address."""
    if not address or not encoding.is_valid_address(address):
        raise HTTPException(status_code=400, detail="Invalid Algorand address")
    nonce = create_challenge(address)
    return {"success": True, "nonce": nonce}


@router.post("/verify")
def verify_auth(data: AuthVerifyRequest):
    """Verify a signed challenge and return a JWT token."""
    if not encoding.is_valid_address(data.address):
        raise HTTPException(status_code=400, detail="Invalid Algorand address")

    # 1. Check nonce is valid and not expired
    if not verify_nonce(data.address, data.nonce):
        raise HTTPException(status_code=401, detail="Invalid or expired challenge")

    # 2. Verify the wallet signature
    if not verify_wallet_signature(data.address, data.nonce, data.signature):
        raise HTTPException(status_code=401, detail="Signature verification failed")

    # 3. Issue JWT
    consume_challenge(data.address)
    token = create_token(data.address)
    return {"success": True, "token": token, "address": data.address}
