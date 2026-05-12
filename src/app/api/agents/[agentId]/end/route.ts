import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import { runSynthesisForProject } from "@/lib/agents/synthesis";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  const agent = getAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: stakeholder, error: stErr } = await db
    .from("stakeholders")
    .select("id, project_id, conversation_ended_at")
    .eq("token", token)
    .eq("agent_id", agent.id)
    .single();

  if (stErr || !stakeholder) {
    return Response.json({ error: "Invalid interview link" }, { status: 404 });
  }

  // Idempotent: if already ended, return success without re-triggering synthesis
  if (stakeholder.conversation_ended_at) {
    return Response.json({ ok: true, alreadyEnded: true });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("stakeholders")
    .update({
      status: "completed",
      conversation_ended_at: now,
      completed_at: now,
    })
    .eq("id", stakeholder.id);

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  // Fire-and-forget synthesis. Vercel Fluid Compute keeps the lambda alive
  // long enough for typical Groq generation (5–15s). If it fails, the admin
  // can manually regenerate from the project detail page.
  void runSynthesisForProject(agent.id, stakeholder.project_id).catch((err) => {
    console.error("[end] background synthesis failed", err);
  });

  return Response.json({ ok: true });
}
