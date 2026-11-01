import secrets

from cryptography.fernet import Fernet


def main() -> None:
    print(f"JWT_SECRET={secrets.token_urlsafe(48)}")
    print(f"ESCROW_ENCRYPTION_KEY={Fernet.generate_key().decode()}")


if __name__ == "__main__":
    main()
