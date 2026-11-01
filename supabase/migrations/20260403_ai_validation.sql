create extension if not exists pgcrypto;

create table if not exists public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  "submissionId" uuid not null unique references public.submissions(id) on delete cascade,
  "bountyId" uuid not null references public.bounties(id) on delete cascade,
  provider text not null default 'heuristic',
  status text not null default 'completed' check (status in ('completed', 'failed', 'skipped')),
  "reviewMode" text not null default 'generic_link',
  recommendation text null check (recommendation in ('recommended', 'needs_review', 'high_risk')),
  summary text not null default '',
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  "relevanceScore" integer not null default 0 check ("relevanceScore" >= 0 and "relevanceScore" <= 100),
  "completenessScore" integer not null default 0 check ("completenessScore" >= 0 and "completenessScore" <= 100),
  "riskScore" integer not null default 0 check ("riskScore" >= 0 and "riskScore" <= 100),
  flags text[] not null default '{}',
  "evidencePreview" text null,
  "codeSignals" jsonb null,
  "rawResponse" jsonb null,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now())
);

alter table public.ai_reviews
  add column if not exists "reviewMode" text not null default 'generic_link',
  add column if not exists "evidencePreview" text null,
  add column if not exists "codeSignals" jsonb null,
  add column if not exists "rawResponse" jsonb null;

create index if not exists ai_reviews_bounty_idx on public.ai_reviews ("bountyId");
