create extension if not exists "pgcrypto";

create type public.exam_mode as enum ('QUICK_15', 'FULL_PAPER');
create type public.exam_session_state as enum (
  'CREATED',
  'READY',
  'IN_PROGRESS',
  'PAUSED',
  'SUBMITTED',
  'GRADING',
  'GRADED',
  'FAILED',
  'CANCELLED'
);
create type public.question_type as enum ('single_choice', 'multiple_choice', 'fill_blank', 'free_response');
create type public.paper_status as enum ('DRAFT', 'CONTENT_REVIEW', 'RUBRIC_REVIEW', 'AI_CALIBRATION', 'PREVIEW', 'PUBLISHED', 'RETIRED');
create type public.grading_job_state as enum ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  openid_hash text unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  cohort_year int,
  region_code text,
  track text,
  original_scores jsonb,
  updated_at timestamptz not null default now()
);

create table public.papers (
  id text primary key,
  title text not null,
  year int not null,
  region text not null,
  track text not null,
  subject text not null,
  paper_type text not null,
  total_score int not null,
  duration_minutes int not null,
  version int not null default 1,
  status public.paper_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null references public.papers(id) on delete cascade,
  title text not null,
  order_no int not null,
  max_score int not null,
  unique (paper_id, order_no)
);

create table public.questions (
  id text primary key,
  paper_id text not null references public.papers(id) on delete cascade,
  section_id uuid references public.sections(id) on delete set null,
  order_no int not null,
  type public.question_type not null,
  stem_json jsonb not null,
  input_schema jsonb not null default '{}'::jsonb,
  max_score numeric(6,2) not null,
  version int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (paper_id, order_no)
);

create table public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  version int not null,
  canonical_answer jsonb not null,
  equivalence_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (question_id, version)
);

create table public.grading_rubrics (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id) on delete cascade,
  version int not null,
  rubric_items_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (question_id, version)
);

create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  paper_id text not null references public.papers(id),
  mode public.exam_mode not null,
  state public.exam_session_state not null default 'CREATED',
  settings jsonb not null default '{}'::jsonb,
  start_at timestamptz,
  deadline_at timestamptz,
  paused_duration_seconds int not null default 0,
  submitted_version_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.answer_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id text not null references public.questions(id),
  content_json jsonb not null,
  source text not null default 'user',
  client_version int not null,
  server_version int not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (session_id, question_id, server_version)
);

alter table public.exam_sessions
  add constraint exam_sessions_submitted_version_fk
  foreign key (submitted_version_id) references public.answer_versions(id);

create table public.ai_help_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id text not null references public.questions(id),
  level int not null check (level between 1 and 4),
  pre_ai_version_id uuid references public.answer_versions(id),
  user_message text,
  output_json jsonb not null,
  model_config_id uuid,
  prompt_version_id uuid,
  reveals_final_answer boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.grading_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  state public.grading_job_state not null default 'QUEUED',
  model_set jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create table public.grading_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.grading_jobs(id) on delete cascade,
  question_id text not null references public.questions(id),
  answer_version_id uuid not null references public.answer_versions(id),
  score numeric(6,2) not null,
  max_score numeric(6,2) not null,
  confidence numeric(4,3) not null,
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  unique (job_id, question_id, answer_version_id)
);

create table public.exam_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete cascade,
  grading_job_id uuid not null references public.grading_jobs(id),
  independent_score numeric(6,2) not null,
  collaborative_score numeric(6,2) not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.share_cards (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.exam_reports(id) on delete cascade,
  template text not null,
  public_fields jsonb not null default '{}'::jsonb,
  object_url text,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table public.model_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  purpose text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  version int not null,
  content_hash text not null,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  unique (purpose, version)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index idx_papers_lookup on public.papers (year, region, track, subject, paper_type, status);
create index idx_questions_paper_order on public.questions (paper_id, order_no);
create index idx_sessions_user_state on public.exam_sessions (user_id, state, updated_at desc);
create index idx_answer_versions_session_question on public.answer_versions (session_id, question_id, server_version desc);
create index idx_ai_help_session_question on public.ai_help_events (session_id, question_id, created_at);
create index idx_grading_jobs_state_created on public.grading_jobs (state, created_at);
create index idx_grading_results_job_question on public.grading_results (job_id, question_id);
create index idx_share_cards_token on public.share_cards (token);

alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.answer_versions enable row level security;
alter table public.ai_help_events enable row level security;
alter table public.grading_jobs enable row level security;
alter table public.grading_results enable row level security;
alter table public.exam_reports enable row level security;
alter table public.share_cards enable row level security;

comment on table public.answer_versions is 'Immutable answer snapshots; grading and AI-help events must reference specific versions.';
comment on table public.ai_help_events is 'AI tutoring events; pre_ai_version_id protects independent-score integrity.';
comment on table public.grading_jobs is 'Idempotent asynchronous grading jobs created by submit flow.';
