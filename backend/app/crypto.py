"""
Encryption module for securing escrow private keys at rest.

Uses Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256)
so that escrow private keys are never stored as plaintext in Supabase.
Keys are only decrypted in-memory when needed for payout transactions.
"""

from cryptography.fernet import Fernet, InvalidToken
from app.config import ESCROW_ENCRYPTION_KEY

_fernet = Fernet(ESCROW_ENCRYPTION_KEY.encode())


def encrypt_private_key(private_key: str) -> str:
    """Encrypt an Algorand private key string. Returns a base64 ciphertext string."""
    return _fernet.encrypt(private_key.encode()).decode()


def decrypt_private_key(encrypted_key: str) -> str:
    """Decrypt a previously encrypted Algorand private key. Returns the original key string."""
    if not encrypted_key:
        raise ValueError("Stored escrow secret is missing")

    try:
        return _fernet.decrypt(encrypted_key.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored escrow secret is not a valid encrypted account key") from exc
