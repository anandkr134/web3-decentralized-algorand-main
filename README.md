# BountyBase

BountyBase is an Algorand bounty platform with a Next.js frontend, a FastAPI backend, Supabase storage, and Algorand escrow payouts.

## Stack

- `frontend/`: Next.js 16, React 19, Pera Wallet, Algorand SDK
- `backend/`: FastAPI, Supabase Python client, Algorand SDK
- `supabase/schema.sql`: canonical database schema for production and local bootstrap

## Prerequisites

- Node.js 20+
- Python 3.12+
- A Supabase project
- An Algorand node endpoint such as Algonode
- A Pera-compatible wallet for frontend testing

## 1. Database Setup

Run the SQL in [supabase/schema.sql](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/supabase/schema.sql) inside the Supabase SQL editor for your target project.

This creates:

- `bounties`
- `submissions`
- `auth_challenges`
- indexes and update triggers

The backend uses the Supabase service-role key and does not require direct frontend Supabase access.

## 2. Backend Environment

Copy [backend/.env.example](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/backend/.env.example) to `backend/.env` and fill in real values.

Required values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ESCROW_ENCRYPTION_KEY`

Generate secure values with:

```bash
cd backend
python3 scripts/generate_secrets.py
```

Important:

- `JWT_SECRET` must be stable across restarts or all sessions will break.
- `ESCROW_ENCRYPTION_KEY` must be a valid Fernet key and must never be rotated without a data-migration plan, because existing encrypted escrow keys depend on it.

## 3. Frontend Environment

Copy [frontend/.env.example](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/frontend/.env.example) to `frontend/.env.local`.

Set:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ALGOD_SERVER`
- `NEXT_PUBLIC_ALGOD_TOKEN`
- `NEXT_PUBLIC_ALGOD_PORT`

Legacy Firebase environment keys are no longer used and can be removed from old `.env.local` files.

## 4. Install Dependencies

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 5. Run Locally

Backend:

```bash
cd backend
source venv/bin/activate
python3 main.py
```

Frontend:

```bash
cd frontend
npm run dev
```

## 6. Readiness Check

The backend exposes:

- `/api/health`
- `/api/health/ready`

`/api/health/ready` verifies:

- Supabase connectivity and required tables
- Algod connectivity

It returns `503` until the environment and database are correctly configured.

## Security Notes

- Wallet auth uses challenge-response signatures and JWT bearer tokens.
- Challenges are stored hashed in Supabase and expire automatically by timestamp validation.
- Bounty funding confirmation validates the on-chain payment sender, receiver, confirmation state, and exact amount before opening a bounty.
- Dashboard access is authenticated and no longer accepts arbitrary creator addresses.
- Creator submission history is private unless requested by the authenticated submitter.
- Escrow private keys are encrypted at rest.

## Production Checklist

- Set `API_ENV=production`
- Set `ENABLE_DOCS=false`
- Set `FRONTEND_ORIGIN`, `CORS_ORIGINS`, and `TRUSTED_HOSTS` to real domains
- Use a real HTTPS deployment for frontend and backend
- Store `backend/.env` secrets in a secret manager, not in git or deployment scripts
- Use a dedicated production Supabase project and a dedicated Algorand network endpoint
- Monitor `/api/health/ready`
- Back up the Fernet key used by `ESCROW_ENCRYPTION_KEY`

## Current Manual Items

These still require real environment values from you:

- production Supabase URL and service-role key
- production `JWT_SECRET`
- production `ESCROW_ENCRYPTION_KEY`
- final frontend/backend domain names for CORS and trusted hosts
- the Supabase SQL from [supabase/schema.sql](/Users/ajiteshvishwakarma/Documents/BLOCKCHAIN_ALGORAND/web3-algorand/supabase/schema.sql) applied to your actual project
