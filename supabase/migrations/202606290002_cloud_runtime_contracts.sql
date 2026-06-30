create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'grading_jobs'
  ) then
    perform pgmq.create('grading_jobs');
  end if;
end $$;

create or replace function public.enqueue_grading_job(
  p_job_id uuid,
  p_session_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  v_message_id bigint;
begin
  select *
  into v_message_id
  from pgmq.send(
    'grading_jobs',
    jsonb_build_object(
      'job_id', p_job_id,
      'session_id', p_session_id,
      'queued_at', now()
    )
  );

  return v_message_id;
end;
$$;

revoke all on function public.enqueue_grading_job(uuid, uuid) from public;
grant execute on function public.enqueue_grading_job(uuid, uuid) to service_role;

create or replace view public.review_queue as
select
  gj.id as grading_job_id,
  er.id as report_id,
  es.id as session_id,
  gj.state,
  coalesce((er.summary ->> 'reviewCount')::int, 0) as review_count,
  coalesce((er.summary ->> 'lowConfidenceCount')::int, 0) as low_confidence_count,
  er.independent_score,
  er.collaborative_score,
  er.created_at
from public.exam_reports er
join public.grading_jobs gj on gj.id = er.grading_job_id
join public.exam_sessions es on es.id = er.session_id
where
  coalesce((er.summary ->> 'reviewCount')::int, 0) > 0
  or coalesce((er.summary ->> 'lowConfidenceCount')::int, 0) > 0;

comment on function public.enqueue_grading_job(uuid, uuid) is
  'Service-role-only bridge from submit API to the Supabase Queues grading_jobs queue.';

comment on view public.review_queue is
  'Operational reviewer queue derived from graded reports; expose through server API only.';

comment on table public.share_cards is
  'Share-card metadata; rendered poster objects are stored in the private-to-service share-cards storage bucket and exposed only through public fields.';
