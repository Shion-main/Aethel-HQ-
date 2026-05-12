import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";
import {
  draftFollowUpEmail,
  type FollowUpTone,
} from "@/lib/agents/follow-up";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TONES: FollowUpTone[] = [
  "initial_response",
  "schedule_meeting",
  "status_update",
  "decline",
  "custom",
];

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  requireAdmin();

  const agent = getConversationalAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { stakeholderId?: string; tone?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stakeholderId, tone, notes } = body;
  if (!stakeholderId) {
    return Response.json({ error: "Missing stakeholderId" }, { status: 400 });
  }
  const validTone = tone as FollowUpTone | undefined;
  if (!validTone || !VALID_TONES.includes(validTone)) {
    return Response.json({ error: "Invalid tone" }, { status: 400 });
  }
  if (validTone === "custom" && !notes?.trim()) {
    return Response.json(
      { error: "Custom tone requires notes describing what to write." },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: stakeholder } = await db
    .from("stakeholders")
    .select(
      "id, name, role, email, company, project_id, intake_data, projects(name, context)"
    )
    .eq("id", stakeholderId)
    .eq("agent_id", agent.id)
    .single();
  if (!stakeholder) {
    return Response.json({ error: "Stakeholder not found" }, { status: 404 });
  }

  const projectsField = stakeholder.projects as
    | { name: string; context: string | null }
    | { name: string; context: string | null }[]
    | null;
  const project = Array.isArray(projectsField) ? projectsField[0] : projectsField;

  const { data: latestBrd } = await db
    .from("documents")
    .select("content")
    .eq("project_id", stakeholder.project_id)
    .eq("kind", agent.synthesis.documentKind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const intake = (stakeholder.intake_data as Record<string, string>) || {};

  try {
    const draft = await draftFollowUpEmail({
      agent,
      tone: validTone,
      adminNotes: notes || "",
      stakeholder: {
        name: intake.name || stakeholder.name,
        role: intake.role || stakeholder.role,
        email: stakeholder.email || intake.email || null,
        company: stakeholder.company || intake.company || null,
      },
      projectName: project?.name || "this project",
      projectContext: project?.context || null,
      latestBrdContent: (latestBrd?.content as string) || null,
    });

    return Response.json({ draft });
  } catch (err) {
    console.error("[follow-up] Groq error", err);
    return Response.json(
      { error: "Draft generation failed. Please try again." },
      { status: 503 }
    );
  }
}
