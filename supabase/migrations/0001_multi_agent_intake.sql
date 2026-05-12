-- Multi-agent + intake schema migration
-- Applied via Supabase MCP on 2026-05-13

alter table stakeholders
  add column agent_id              text not null default 'business-analyst',
  add column email                 text,
  add column company               text,
  add column intake_data           jsonb not null default '{}'::jsonb,
  add column intake_completed_at   timestamptz,
  add column conversation_ended_at timestamptz,
  add column follow_up_status      text not null default 'new'
    check (follow_up_status in ('new','interested','following_up','closed','hired'));

-- Legacy rows: skip intake gate; current state is considered intake-complete.
update stakeholders set intake_completed_at = created_at where intake_completed_at is null;

create index idx_stakeholders_agent     on stakeholders(agent_id);
create index idx_stakeholders_follow_up on stakeholders(follow_up_status);

alter table projects add column agent_id text not null default 'business-analyst';
alter table brds     add column agent_id text not null default 'business-analyst';
