create extension if not exists pgcrypto;

create table if not exists public.dispute_cases (
  id uuid primary key default gen_random_uuid(),
  "bountyId" uuid not null unique references public.bounties(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved', 'manual_execution_required')),
  quorum integer not null check (quorum > 0),
  "eligibleJurors" text[] not null default '{}',
  "createdBy" text not null,
  resolution text null check (resolution in ('approve_submission', 'refund_creator')),
  "resolutionSubmissionId" uuid null references public.submissions(id) on delete set null,
  "resolutionWinner" text null,
  "resolutionTxId" text null,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "resolvedAt" timestamptz null
);

create index if not exists dispute_cases_status_idx on public.dispute_cases (status);

create table if not exists public.dispute_votes (
  id uuid primary key default gen_random_uuid(),
  "caseId" uuid not null references public.dispute_cases(id) on delete cascade,
  "bountyId" uuid not null references public.bounties(id) on delete cascade,
  juror text not null,
  decision text not null check (decision in ('approve_submission', 'refund_creator')),
  "submissionId" uuid null references public.submissions(id) on delete set null,
  "createdAt" timestamptz not null default timezone('utc', now())
);

create unique index if not exists dispute_votes_case_juror_uidx on public.dispute_votes ("caseId", juror);
create index if not exists dispute_votes_bounty_idx on public.dispute_votes ("bountyId");
