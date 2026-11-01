import http.client
import os
import socket
import time
import urllib.error
from collections.abc import Callable
from typing import TypeVar

import certifi
from algosdk.v2client import algod
from app.config import ALGOD_PORT, ALGOD_SERVER, ALGOD_TOKEN

T = TypeVar("T")

TRANSIENT_ALGOD_ERRORS = (
    http.client.RemoteDisconnected,
    TimeoutError,
    ConnectionResetError,
    socket.timeout,
    urllib.error.URLError,
)


def get_algod_client():
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    address = ALGOD_SERVER.rstrip("/")
    if ALGOD_PORT and f":{ALGOD_PORT}" not in address and "://" in address:
        address = f"{address}:{ALGOD_PORT}"
    return algod.AlgodClient(ALGOD_TOKEN, address)


algod_client = get_algod_client()


def algod_call_with_retry(
    operation_name: str,
    fn: Callable[[], T],
    attempts: int = 3,
    base_delay_seconds: float = 0.6,
) -> T:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except TRANSIENT_ALGOD_ERRORS as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(base_delay_seconds * attempt)

    assert last_error is not None
    raise RuntimeError(
        f"Algorand node request failed during {operation_name} after {attempts} attempts: {last_error}"
    ) from last_error
