create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 140),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  reward numeric(20, 6) not null check (reward > 0),
  deadline timestamptz not null,
  creator text not null,
  "escrowAddress" text not null unique,
  "escrowSecret" text not null,
  status text not null check (status in ('pending_funding', 'open', 'completed')),
  "fundingTxId" text unique,
  winner text,
  "winnerSubmissionId" uuid,
  "payoutTxId" text unique,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now())
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  "bountyId" uuid not null references public.bounties(id) on delete cascade,
  submitter text not null,
  description text not null check (char_length(trim(description)) between 10 and 5000),
  "proofLink" text not null check (char_length(trim("proofLink")) between 8 and 2048),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  "submittedAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now()),
  unique ("bountyId", submitter)
);

alter table public.bounties
  drop constraint if exists bounties_winner_submission_fk;

alter table public.bounties
  add constraint bounties_winner_submission_fk
  foreign key ("winnerSubmissionId")
  references public.submissions(id)
  on delete set null;

create table if not exists public.auth_challenges (
  address text primary key,
  "nonceHash" text not null,
  "expiresAt" bigint not null check ("expiresAt" > 0),
  "createdAt" timestamptz not null default timezone('utc', now())
);

create index if not exists idx_bounties_creator on public.bounties (creator);
create index if not exists idx_bounties_status_created_at on public.bounties (status, "createdAt" desc);
create index if not exists idx_bounties_deadline on public.bounties (deadline);
create index if not exists idx_submissions_bounty_status on public.submissions ("bountyId", status);
create index if not exists idx_submissions_submitter on public.submissions (submitter);
create index if not exists idx_auth_challenges_expires_at on public.auth_challenges ("expiresAt");

drop trigger if exists set_bounties_updated_at on public.bounties;
create trigger set_bounties_updated_at
before update on public.bounties
for each row
execute function public.set_updated_at();

drop trigger if exists set_submissions_updated_at on public.submissions;
create trigger set_submissions_updated_at
before update on public.submissions
for each row
execute function public.set_updated_at();

alter table public.bounties enable row level security;
alter table public.submissions enable row level security;
alter table public.auth_challenges enable row level security;
