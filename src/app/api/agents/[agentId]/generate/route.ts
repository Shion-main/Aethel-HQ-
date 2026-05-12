import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import { runGenerativeForProject } from "@/lib/agents/generate-document";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  requireAdmin();

  const agent = getAgent(params.agentId);
  if (!agent || agent.kind !== "generative") {
    return Response.json({ error: "Agent not found" }, { status: 404 });
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
    const result = await runGenerativeForProject(agent.id, projectId);
    if (!result.ok) {
      const status =
        result.reason === "project_not_found"
          ? 404
          : result.reason === "brd_missing"
            ? 400
            : 500;
      return Response.json({ error: result.reason }, { status });
    }

    const db = supabaseAdmin();
    const { data: document } = await db
      .from("documents")
      .select("id, content, created_at, kind, title")
      .eq("id", result.documentId)
      .single();

    return Response.json({ document });
  } catch (err) {
    console.error("[generate] Groq error", err);
    return Response.json(
      { error: "Document generation failed. Please try again." },
      { status: 503 }
    );
  }
}
