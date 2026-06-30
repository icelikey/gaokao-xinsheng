alter table public.share_cards
  add column if not exists idempotency_key text;

create unique index if not exists idx_share_cards_report_idempotency
  on public.share_cards (report_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.share_cards.idempotency_key is
  'Server API idempotency key used to avoid duplicate share-card generation for a report.';
