import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";

export const runtime = "nodejs";

type PatchBody = { content?: string; revert?: boolean };

const SELECT =
  "id, content, edited_content, edited_at, human_edited, created_at, kind, title";

export async function PATCH(
  req: Request,
  { params }: { params: { agentId: string; documentId: string } }
) {
  requireAdmin();

  const agent = getAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("documents")
    .select("id, agent_id")
    .eq("id", params.documentId)
    .single();
  if (!existing) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.agent_id !== agent.id) {
    return Response.json({ error: "Document belongs to a different agent" }, { status: 403 });
  }

  const update = body.revert
    ? { edited_content: null, edited_at: null, human_edited: false }
    : (() => {
        const content = (body.content ?? "").trim();
        if (!content) return null;
        return {
          edited_content: body.content,
          edited_at: new Date().toISOString(),
          human_edited: true,
        };
      })();

  if (!update) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const { data: updated, error } = await db
    .from("documents")
    .update(update)
    .eq("id", params.documentId)
    .select(SELECT)
    .single();

  if (error || !updated) {
    return Response.json({ error: error?.message || "update_failed" }, { status: 500 });
  }

  return Response.json({ document: updated });
}
