from __future__ import annotations

import base64
import os
from pathlib import Path

from algosdk import account, mnemonic, transaction
from algosdk.logic import get_application_address
from algosdk.v2client import algod
from dotenv import load_dotenv


CONTRACTS_DIR = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = CONTRACTS_DIR.parent / "backend" / "contract_artifacts"
APPROVAL_TEAL = ARTIFACTS_DIR / "BountyEscrowContract.approval.teal"
CLEAR_TEAL = ARTIFACTS_DIR / "BountyEscrowContract.clear.teal"

load_dotenv(CONTRACTS_DIR / ".env")


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required but was not set.")
    return value


def compile_program(client: algod.AlgodClient, source_path: Path) -> bytes:
    source = source_path.read_text()
    result = client.compile(source)
    return base64.b64decode(result["result"])


def main() -> None:
    algod_server = os.getenv("TESTNET_ALGOD_SERVER", "https://testnet-api.algonode.cloud").strip()
    algod_token = os.getenv("TESTNET_ALGOD_TOKEN", "").strip()
    algod_port = os.getenv("TESTNET_ALGOD_PORT", "443").strip()
    deployer_mnemonic = require_env("DEPLOYER_MNEMONIC")

    if not APPROVAL_TEAL.exists() or not CLEAR_TEAL.exists():
        raise FileNotFoundError(
            "Compiled TEAL artifacts were not found. Run the compile step first so the "
            "`contracts/artifacts/` directory contains the approval and clear programs."
        )

    client = algod.AlgodClient(algod_token, algod_server, algod_port)
    private_key = mnemonic.to_private_key(deployer_mnemonic)
    sender = account.address_from_private_key(private_key)

    approval_program = compile_program(client, APPROVAL_TEAL)
    clear_program = compile_program(client, CLEAR_TEAL)

    params = client.suggested_params()
    txn = transaction.ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=transaction.StateSchema(num_uints=4, num_byte_slices=3),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
        extra_pages=2,
    )

    signed_txn = txn.sign(private_key)
    tx_id = client.send_transaction(signed_txn)
    confirmation = transaction.wait_for_confirmation(client, tx_id, 10)
    app_id = confirmation["application-index"]
    app_address = get_application_address(app_id)

    print("Deployment successful")
    print(f"Creator: {sender}")
    print(f"Application ID: {app_id}")
    print(f"Application Address: {app_address}")
    print(f"Transaction ID: {tx_id}")
    print("Next step: call `bootstrap_bounty(reward_microalgos, deadline)` from the creator wallet.")


if __name__ == "__main__":
    main()
