import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SYNTHESIZER_SYSTEM_PROMPT } from "@/lib/agents/business-analyst/prompts";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_ID = "gemini-2.5-flash";

export async function POST(req: Request) {
  requireAdmin();

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

  const db = supabaseAdmin();

  const { data: project, error: pErr } = await db
    .from("projects")
    .select("id, name, context")
    .eq("id", projectId)
    .single();
  if (pErr || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: stakeholders } = await db
    .from("stakeholders")
    .select("id, name, role, status")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  if (!stakeholders?.length) {
    return Response.json(
      { error: "No completed stakeholder interviews yet." },
      { status: 400 }
    );
  }

  const ids = stakeholders.map((s) => s.id);
  const { data: allMessages } = await db
    .from("messages")
    .select("stakeholder_id, role, content, created_at")
    .in("stakeholder_id", ids)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const transcripts = stakeholders
    .map((s) => {
      const turns = (allMessages || [])
        .filter((m) => m.stakeholder_id === s.id)
        .map((m) => {
          const speaker = m.role === "user" ? s.name : "Interviewer";
          return `${speaker}: ${stripCompletionToken(m.content)}`;
        })
        .join("\n\n");
      return `## Stakeholder: ${s.name}${s.role ? ` (${s.role})` : ""}\n\n${turns}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = `# Project context\n\n${project.context || "(none provided)"}\n\n# Transcripts\n\n${transcripts}\n\nProduce the BRD now. Use "${project.name}" as the project name in the title.`;

  try {
    const { text } = await generateText({
      model: google(MODEL_ID),
      system: SYNTHESIZER_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.4,
    });

    const { data: brd, error: brdErr } = await db
      .from("brds")
      .insert({
        project_id: projectId,
        content: text,
        model: MODEL_ID,
      })
      .select("id, content, created_at")
      .single();

    if (brdErr) {
      return Response.json({ error: brdErr.message }, { status: 500 });
    }

    return Response.json({ brd });
  } catch (err) {
    console.error("[synthesize] Gemini error", err);
    return Response.json(
      { error: "BRD generation failed. Please try again." },
      { status: 503 }
    );
  }
}
