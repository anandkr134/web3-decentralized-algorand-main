alter table public.bounties
drop constraint if exists bounties_status_check;

alter table public.bounties
add constraint bounties_status_check
check (
  status in (
    'pending_funding',
    'open',
    'under_review',
    'completed',
    'disputed',
    'expired',
    'refunded'
  )
);
