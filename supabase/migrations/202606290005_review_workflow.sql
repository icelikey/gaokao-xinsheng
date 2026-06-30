create table if not exists public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.exam_reports(id) on delete cascade,
  grading_job_id uuid not null references public.grading_jobs(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN', 'ASSIGNED', 'RESOLVED', 'REJECTED')),
  assignee text,
  reviewer_note text,
  resolved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id)
);

create index if not exists idx_review_tasks_status_updated on public.review_tasks (status, updated_at desc);
create index if not exists idx_review_tasks_grading_job on public.review_tasks (grading_job_id);

alter table public.review_tasks enable row level security;

create or replace view public.review_queue as
select
  gj.id as grading_job_id,
  er.id as report_id,
  es.id as session_id,
  gj.state,
  coalesce(rt.status, 'OPEN') as review_status,
  rt.assignee,
  rt.reviewer_note,
  coalesce(audit_counts.audit_count, 0) as audit_count,
  coalesce((er.summary ->> 'reviewCount')::int, 0) as review_count,
  coalesce((er.summary ->> 'lowConfidenceCount')::int, 0) as low_confidence_count,
  er.independent_score,
  er.collaborative_score,
  coalesce((er.summary ->> 'totalScore')::numeric, er.collaborative_score) as total_score,
  er.created_at,
  coalesce(rt.updated_at, er.created_at) as updated_at
from public.exam_reports er
join public.grading_jobs gj on gj.id = er.grading_job_id
join public.exam_sessions es on es.id = er.session_id
left join public.review_tasks rt on rt.report_id = er.id
left join lateral (
  select count(*)::int as audit_count
  from public.audit_logs al
  where al.target = concat('report:', er.id::text)
    and al.action like 'review.%'
) audit_counts on true
where
  (
    coalesce((er.summary ->> 'reviewCount')::int, 0) > 0
    or coalesce((er.summary ->> 'lowConfidenceCount')::int, 0) > 0
  )
  and coalesce(rt.status, 'OPEN') not in ('RESOLVED', 'REJECTED');

comment on table public.review_tasks is
  'Manual review workflow state for low-confidence or subjective grading reports; expose through server API only.';

comment on view public.review_queue is
  'Active operational reviewer queue with workflow state and audit counts; expose through server API only.';
