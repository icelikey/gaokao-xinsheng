create table if not exists public.paper_import_batches (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null,
  title text not null,
  actor text not null,
  dry_run boolean not null default true,
  conflict_policy text not null default 'replace_preview'
    check (conflict_policy in ('replace_preview')),
  status text not null check (status in ('VALIDATED', 'REJECTED', 'IMPORTED')),
  payload_hash text not null,
  summary jsonb not null default '{}'::jsonb,
  commit_summary jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_paper_import_batches_paper_created
  on public.paper_import_batches (paper_id, created_at desc);

create index if not exists idx_paper_import_batches_status_created
  on public.paper_import_batches (status, created_at desc);

alter table public.paper_import_batches enable row level security;

comment on table public.paper_import_batches is
  'Admin-only paper import validation batches. Direct client access remains disabled until admin auth is configured.';
