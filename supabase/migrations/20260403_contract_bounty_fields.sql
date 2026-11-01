alter table public.bounties
  add column if not exists "escrowMode" text not null default 'account',
  add column if not exists "contractAppId" bigint,
  add column if not exists "contractDeploymentTxId" text,
  add column if not exists "contractBootstrapTxId" text;

create index if not exists bounties_contract_app_id_idx
  on public.bounties ("contractAppId");
