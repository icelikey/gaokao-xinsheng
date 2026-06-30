create table public.paper_mapping_rules (
  id text primary key,
  year int not null,
  region text not null,
  region_code text not null,
  track text not null,
  subject text not null,
  mode public.exam_mode not null,
  paper_id text not null references public.papers(id),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  explanation text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, region_code, track, subject, mode, paper_id)
);

create index idx_paper_mapping_rules_lookup
  on public.paper_mapping_rules (year, region, track, subject, mode, status, confidence desc);

comment on table public.paper_mapping_rules is 'Maps cohort profile inputs to candidate paper versions for the paper matching flow.';
