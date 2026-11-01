from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path

from algosdk import account, mnemonic, transaction
from algosdk.atomic_transaction_composer import AccountTransactionSigner, AtomicTransactionComposer
from algosdk.abi import Method
from algosdk.encoding import decode_address, encode_address
from algosdk.logic import get_application_address
from fastapi import HTTPException

from app.algorand import algod_call_with_retry, algod_client
from app.config import (
    CONTRACT_APPROVAL_TEAL_PATH,
    CONTRACT_CLEAR_TEAL_PATH,
    CONTRACT_DEPLOYER_MNEMONIC,
    CONTRACT_ESCROW_ENABLED,
)
from app.time_utils import utc_now


BOOTSTRAP_BOUNTY_METHOD = Method.from_signature("bootstrap_bounty(address,uint64,uint64)void")
CLOSE_SUBMISSIONS_METHOD = Method.from_signature("close_submissions()void")
CONTRACT_APP_ACCOUNT_MIN_BALANCE_MICROALGOS = 100_000
CONTRACT_ESCROW_FEE_BUFFER_MICROALGOS = 3_000
CONTRACT_BOX_FLAT_MIN_BALANCE_MICROALGOS = 2_500
CONTRACT_BOX_BYTE_MIN_BALANCE_MICROALGOS = 400
SUBMISSION_BOX_PREFIX = b"submission:"
SUBMISSION_BOX_KEY_LENGTH = len(SUBMISSION_BOX_PREFIX) + 32
SUBMISSION_BOX_VALUE_LENGTH = 32
CONTRACT_SINGLE_SUBMISSION_BOX_MIN_BALANCE_MICROALGOS = (
    CONTRACT_BOX_FLAT_MIN_BALANCE_MICROALGOS
    + CONTRACT_BOX_BYTE_MIN_BALANCE_MICROALGOS
    * (SUBMISSION_BOX_KEY_LENGTH + SUBMISSION_BOX_VALUE_LENGTH)
)


@dataclass
class ContractDeployment:
    app_id: int
    app_address: str
    deployment_tx_id: str
    bootstrap_tx_id: str


def is_contract_escrow_enabled() -> bool:
    return CONTRACT_ESCROW_ENABLED


def required_contract_funding_microalgos(reward_microalgos: int) -> int:
    return (
        reward_microalgos
        + CONTRACT_APP_ACCOUNT_MIN_BALANCE_MICROALGOS
        + CONTRACT_SINGLE_SUBMISSION_BOX_MIN_BALANCE_MICROALGOS
        + CONTRACT_ESCROW_FEE_BUFFER_MICROALGOS
    )


def _require_deployer_signer() -> tuple[str, str, AccountTransactionSigner]:
    if not CONTRACT_DEPLOYER_MNEMONIC:
        raise HTTPException(
            status_code=500,
            detail=(
                "Contract escrow is enabled, but CONTRACT_DEPLOYER_MNEMONIC is not configured "
                "on the backend."
            ),
        )

    try:
        private_key = mnemonic.to_private_key(CONTRACT_DEPLOYER_MNEMONIC)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "CONTRACT_DEPLOYER_MNEMONIC must be a valid 25-word Algorand mnemonic "
                "on the backend."
            ),
        ) from exc

    sender = account.address_from_private_key(private_key)
    return private_key, sender, AccountTransactionSigner(private_key)


def _compile_program(path_value: str) -> bytes:
    path = Path(path_value)
    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                f"Missing compiled contract artifact at {path}. Compile the smart contract first "
                "and point CONTRACT_APPROVAL_TEAL_PATH / CONTRACT_CLEAR_TEAL_PATH to the generated TEAL files."
            ),
        )

    source = path.read_text()
    compiled = algod_call_with_retry(
        "compiling the smart contract",
        lambda: algod_client.compile(source),
    )
    return base64.b64decode(compiled["result"])


def _load_contract_global_state(app_id: int) -> dict:
    app_info = algod_call_with_retry(
        "loading the bounty contract state",
        lambda: algod_client.application_info(app_id),
    )
    entries = ((app_info.get("params") or {}).get("global-state")) or []

    decoded_state: dict[str, object] = {}
    for entry in entries:
        key_raw = base64.b64decode(entry["key"])
        key = key_raw.decode("utf-8")
        value = entry.get("value") or {}
        value_type = value.get("type")

        if value_type == 1:
            raw_bytes = base64.b64decode(value.get("bytes") or "")
            if key in {"creator", "winner"}:
                decoded_state[key] = encode_address(raw_bytes) if raw_bytes and any(raw_bytes) else None
            elif key == "status":
                decoded_state[key] = raw_bytes.decode("utf-8")
            else:
                decoded_state[key] = raw_bytes
        else:
            decoded_state[key] = value.get("uint", 0)

    return decoded_state


def get_contract_state(app_id: int) -> dict[str, object]:
    state = _load_contract_global_state(app_id)
    if not state:
        raise HTTPException(status_code=500, detail=f"Contract state for app {app_id} could not be loaded")
    return state


def get_contract_submission_hash(app_id: int, submitter: str) -> bytes | None:
    box_name = b"submission:" + decode_address(submitter)
    try:
        payload = algod_call_with_retry(
            "loading the submission box from the bounty contract",
            lambda: algod_client.application_box_by_name(app_id, box_name),
        )
    except Exception:
        return None

    if isinstance(payload, bytes):
        return payload

    raw_value = payload.get("value") if isinstance(payload, dict) else None
    if isinstance(raw_value, str):
        try:
            return base64.b64decode(raw_value)
        except Exception:
            return None
    if isinstance(raw_value, bytes):
        return raw_value
    return None


def close_contract_submissions(app_id: int) -> str:
    private_key, sender, signer = _require_deployer_signer()
    params = algod_call_with_retry(
        "fetching transaction params for close_submissions",
        algod_client.suggested_params,
    )

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=CLOSE_SUBMISSIONS_METHOD,
        sender=sender,
        sp=params,
        signer=signer,
        method_args=[],
    )
    result = algod_call_with_retry(
        "executing the close_submissions contract call",
        lambda: atc.execute(algod_client, 8),
    )
    return result.tx_ids[0]


def sync_contract_bounty_state(bounty: dict) -> dict:
    app_id = bounty.get("contractAppId")
    if not app_id:
        return bounty

    state = get_contract_state(int(app_id))
    current_status = state.get("status")
    deadline_unix = state.get("deadline")

    if (
        current_status == "open"
        and isinstance(deadline_unix, int)
        and deadline_unix <= int(utc_now().timestamp())
    ):
        close_contract_submissions(int(app_id))
        state = get_contract_state(int(app_id))
        current_status = state.get("status")

    next_bounty = dict(bounty)
    if isinstance(current_status, str):
        next_bounty["status"] = current_status
    if current_status == "completed" and state.get("winner"):
        next_bounty["winner"] = state["winner"]
    return next_bounty


def deploy_and_bootstrap_bounty_contract(
    creator_address: str,
    reward_microalgos: int,
    deadline_unix: int,
) -> ContractDeployment:
    private_key, deployer_address, signer = _require_deployer_signer()

    approval_program = _compile_program(CONTRACT_APPROVAL_TEAL_PATH)
    clear_program = _compile_program(CONTRACT_CLEAR_TEAL_PATH)

    params = algod_call_with_retry(
        "fetching transaction params for contract deployment",
        algod_client.suggested_params,
    )
    app_create_txn = transaction.ApplicationCreateTxn(
        sender=deployer_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=transaction.StateSchema(num_uints=4, num_byte_slices=3),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
        extra_pages=2,
    )

    signed_create = app_create_txn.sign(private_key)
    deployment_tx_id = algod_call_with_retry(
        "sending the contract deployment transaction",
        lambda: algod_client.send_transaction(signed_create),
    )
    confirmation = algod_call_with_retry(
        "waiting for the contract deployment confirmation",
        lambda: transaction.wait_for_confirmation(algod_client, deployment_tx_id, 8),
    )
    app_id = confirmation["application-index"]

    params = algod_call_with_retry(
        "fetching transaction params for contract bootstrap",
        algod_client.suggested_params,
    )
    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=BOOTSTRAP_BOUNTY_METHOD,
        sender=deployer_address,
        sp=params,
        signer=signer,
        method_args=[creator_address, reward_microalgos, deadline_unix],
    )
    result = algod_call_with_retry(
        "executing the contract bootstrap call",
        lambda: atc.execute(algod_client, 8),
    )
    bootstrap_tx_id = result.tx_ids[0]

    return ContractDeployment(
        app_id=app_id,
        app_address=get_application_address(app_id),
        deployment_tx_id=deployment_tx_id,
        bootstrap_tx_id=bootstrap_tx_id,
    )
