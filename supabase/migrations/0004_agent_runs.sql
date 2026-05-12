-- agent_runs: tracks in-flight + historical generation runs.
-- - Provides idempotency via unique partial index on (agent_id, project_id, kind)
--   WHERE status = 'running' — a second concurrent generation hits a 23505 and is rejected.
-- - Provides observability for failed/slow generations.
-- Applied via Supabase MCP on 2026-05-13.

create table agent_runs (
  id           uuid primary key default gen_random_uuid(),
  agent_id     text not null,
  project_id   uuid not null references projects(id) on delete cascade,
  kind         text not null check (kind in ('synthesis','generative')),
  status       text not null check (status in ('running','completed','failed')),
  error        text,
  document_id  uuid references documents(id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms  integer
);

create unique index uq_agent_runs_running
  on agent_runs(agent_id, project_id, kind)
  where status = 'running';

create index idx_agent_runs_project
  on agent_runs(project_id, kind, started_at desc);
