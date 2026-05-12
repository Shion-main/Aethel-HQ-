import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";
import { runSynthesisForProject } from "@/lib/agents/synthesis";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  requireAdmin();

  const agent = getConversationalAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { projectId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const projectId = body.projectId;
  if (!projectId) {
    return Response.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const result = await runSynthesisForProject(agent.id, projectId);
    if (!result.ok) {
      if (result.reason === "already_running") {
        return Response.json(
          { error: "A BRD is already being generated for this project. Please wait." },
          { status: 409 }
        );
      }
      const status =
        result.reason === "no_stakeholders"
          ? 400
          : result.reason === "project_not_found"
            ? 404
            : 500;
      return Response.json({ error: result.reason }, { status });
    }

    const db = supabaseAdmin();
    const { data: document } = await db
      .from("documents")
      .select("id, content, edited_content, edited_at, human_edited, created_at, kind, title")
      .eq("id", result.outputId)
      .single();

    // brd alias kept for backward compatibility with existing BrdPanel client
    return Response.json({ brd: document, document });
  } catch (err) {
    console.error("[synthesize] Groq error", err);
    return Response.json(
      { error: "BRD generation failed. Please try again." },
      { status: 503 }
    );
  }
}
