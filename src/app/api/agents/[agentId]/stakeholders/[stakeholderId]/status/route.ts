import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import type { FollowUpStatus } from "@/lib/agents/types";

export const runtime = "nodejs";

const VALID_STATUSES: FollowUpStatus[] = [
  "new",
  "interested",
  "following_up",
  "closed",
  "hired",
];

export async function PATCH(
  req: Request,
  { params }: { params: { agentId: string; stakeholderId: string } }
) {
  requireAdmin();

  const agent = getAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status as FollowUpStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("stakeholders")
    .update({ follow_up_status: status })
    .eq("id", params.stakeholderId)
    .eq("agent_id", agent.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
