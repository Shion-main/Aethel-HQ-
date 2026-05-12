import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";
import { runSynthesisForProject } from "@/lib/agents/synthesis";
import { extractProjectMetadata } from "@/lib/agents/project-extractor";

export const runtime = "nodejs";
export const maxDuration = 120;

const PLACEHOLDER_NAME_PREFIX = "Untitled session";

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  const agent = getConversationalAgent(params.agentId);
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
    .select(
      "id, name, role, company, intake_data, project_id, conversation_ended_at"
    )
    .eq("token", token)
    .eq("agent_id", agent.id)
    .single();

  if (stErr || !stakeholder) {
    return Response.json({ error: "Invalid interview link" }, { status: 404 });
  }

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

  // Extract project name + context from the transcript IF the project still
  // has its placeholder name. This runs synchronously so the BRD synthesis
  // below sees the freshly-renamed project.
  try {
    const { data: project } = await db
      .from("projects")
      .select("id, name")
      .eq("id", stakeholder.project_id)
      .single();

    if (project?.name?.startsWith(PLACEHOLDER_NAME_PREFIX)) {
      const { data: msgs } = await db
        .from("messages")
        .select("role, content, created_at")
        .eq("stakeholder_id", stakeholder.id)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: true })
        .limit(40);

      const intake = (stakeholder.intake_data as Record<string, string>) || {};
      const extracted = await extractProjectMetadata({
        model: agent.model,
        stakeholder: {
          name: intake.name || stakeholder.name,
          role: intake.role || stakeholder.role,
          company: stakeholder.company || intake.company || null,
        },
        messages:
          (msgs || []).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })) || [],
      });

      if (extracted) {
        await db
          .from("projects")
          .update({ name: extracted.name, context: extracted.context })
          .eq("id", project.id);
      }
    }
  } catch (err) {
    console.error("[end] project metadata extraction failed", err);
    // Non-fatal: synthesis still runs with the placeholder name.
  }

  // Fire-and-forget synthesis. Vercel Fluid Compute keeps the lambda alive
  // long enough for typical Groq generation (5–15s). If it fails, the admin
  // can manually regenerate from the project detail page.
  void runSynthesisForProject(agent.id, stakeholder.project_id).catch((err) => {
    console.error("[end] background synthesis failed", err);
  });

  return Response.json({ ok: true });
}
