-- Unify brds → documents with a kind discriminator.
-- Applied via Supabase MCP on 2026-05-13.

alter table brds rename to documents;
alter table documents add column kind  text not null default 'brd';
alter table documents add column title text;

drop index if exists idx_brds_project;
create index idx_documents_project_kind
  on documents(project_id, kind, created_at desc);
