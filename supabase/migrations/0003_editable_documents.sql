-- Editable documents: admin can hand-curate AI-generated docs in place.
-- Applied via Supabase MCP on 2026-05-13.

alter table documents
  add column edited_content text,
  add column edited_at      timestamptz,
  add column human_edited   boolean not null default false;
