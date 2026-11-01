# Algorand Smart Contract Scaffold

This directory contains the first smart-contract-based version of the bounty escrow flow.

Current app status:
- The live MVP still uses backend-managed escrow accounts.
- This contract scaffold is the migration path toward on-chain bounty state and payout logic.

## What this contract does

The contract in [bounty_escrow/contract.py](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/contracts/bounty_escrow/contract.py) is designed for one bounty per application instance and includes:

- `bootstrap_bounty`
- `minimum_funding_amount`
- `fund_bounty`
- `submit_work`
- `close_submissions`
- `mark_disputed`
- `approve_winner`
- `refund_creator`

This moves the trust-critical logic toward Algorand instead of the backend holding an escrow private key.

## TestNet deploy flow

The deploy path is:

1. Install AlgoKit and the Algorand Python compiler tooling.
2. Compile the contract into TEAL artifacts.
3. Fund a TestNet deployer account.
4. Deploy the compiled application to TestNet.
5. Bootstrap the bounty from the creator wallet.

## Recommended local setup

Algorand Python currently expects a Python 3.12 environment.

```bash
cd contracts
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Install the compiler tooling from the official Algorand stack:

```bash
brew install algorandfoundation/tap/algokit
pip install puyapy
```

Or use the official AlgoKit workflow if you already have it installed.

## Compile the contract

From the repo root:

```bash
mkdir -p backend/contract_artifacts
algokit compile py contracts/bounty_escrow/contract.py --out-dir backend/contract_artifacts
```

Expected outputs include:

- `backend/contract_artifacts/BountyEscrowContract.approval.teal`
- `backend/contract_artifacts/BountyEscrowContract.clear.teal`

## Configure deployer secrets

Copy the example env file:

```bash
cp contracts/.env.example contracts/.env
```

Fill in:

- `DEPLOYER_MNEMONIC`
- optional custom algod settings if you are not using Algonode TestNet

## Deploy to TestNet

Fund the deployer wallet from the Algorand TestNet dispenser, then run:

```bash
python contracts/scripts/deploy_testnet.py
```

The script will print:

- creator address
- application ID
- application address
- deployment transaction ID

## Enabling contract mode in the backend

The current MVP still defaults to backend-managed escrow accounts. To start Phase 1 contract-backed bounty creation, apply:

1. the Supabase migration in [20260403_contract_bounty_fields.sql](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/supabase/migrations/20260403_contract_bounty_fields.sql)
2. the compiled contract artifacts in `backend/contract_artifacts/`
3. these backend env vars:

```env
CONTRACT_ESCROW_ENABLED=true
CONTRACT_DEPLOYER_MNEMONIC=...
CONTRACT_APPROVAL_TEAL_PATH=/absolute/path/to/backend/contract_artifacts/BountyEscrowContract.approval.teal
CONTRACT_CLEAR_TEAL_PATH=/absolute/path/to/backend/contract_artifacts/BountyEscrowContract.clear.teal
```

With those in place, new bounty creation can deploy and bootstrap a contract-backed bounty app while keeping the rest of the current MVP flow intact.

## How the contract will fit the current app

The intended v2 integration is:

- `Next.js + Pera Wallet` signs grouped app/payment transactions
- `FastAPI` becomes an indexing/helper layer
- `Supabase` stores metadata and analytics, not trust-critical escrow secrets
- bounty payout and refund logic move on-chain

## Important note

This scaffold is the right direction for decentralization, but it is not wired into the frontend/backend yet. The current production demo flow still uses the existing backend escrow path until this contract flow is fully integrated.
