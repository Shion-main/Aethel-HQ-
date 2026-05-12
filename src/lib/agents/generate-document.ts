import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "./registry";
import type {
  GenerativeAgent,
  GenerativeContext,
  GenerativeTranscript,
} from "./types";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";
import { parseSuggestions } from "@/lib/agents/business-analyst/parse-suggestions";

export type GenerateResult =
  | { ok: true; documentId: string }
  | { ok: false; reason: string };

export async function runGenerativeForProject(
  agentId: string,
  projectId: string
): Promise<GenerateResult> {
  const agent = getAgent(agentId);
  if (!agent) return { ok: false, reason: "unknown_agent" };
  if (agent.kind !== "generative") {
    return { ok: false, reason: "agent_not_generative" };
  }
  const generativeAgent: GenerativeAgent = agent;

  const db = supabaseAdmin();

  const { data: project } = await db
    .from("projects")
    .select("id, name, context")
    .eq("id", projectId)
    .single();
  if (!project) return { ok: false, reason: "project_not_found" };

  // Load BRD if needed
  let brd: { content: string } | null = null;
  if (generativeAgent.inputs.needsBrd) {
    const { data: latestBrd } = await db
      .from("documents")
      .select("content")
      .eq("project_id", projectId)
      .eq("kind", "brd")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestBrd) return { ok: false, reason: "brd_missing" };
    brd = { content: latestBrd.content };
  }

  // Load prior documents by kind
  const priorDocuments: Record<
    string,
    Array<{ content: string; created_at: string }>
  > = {};
  for (const kind of generativeAgent.inputs.needsPriorDocuments) {
    const { data: docs } = await db
      .from("documents")
      .select("content, created_at")
      .eq("project_id", projectId)
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    priorDocuments[kind] = (docs || []).map((d) => ({
      content: d.content,
      created_at: d.created_at,
    }));
  }

  // Load transcripts if needed
  let transcripts: GenerativeTranscript[] = [];
  if (generativeAgent.inputs.needsTranscripts) {
    const { data: stakeholders } = await db
      .from("stakeholders")
      .select("id, name, role, intake_data, status")
      .eq("project_id", projectId)
      .eq("status", "completed");
    if (stakeholders?.length) {
      const ids = stakeholders.map((s) => s.id);
      const { data: msgs } = await db
        .from("messages")
        .select("stakeholder_id, role, content, created_at")
        .in("stakeholder_id", ids)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: true });
      transcripts = stakeholders.map((s) => {
        const intake = (s.intake_data as Record<string, string>) || {};
        return {
          stakeholderName: intake.name || s.name,
          stakeholderRole: intake.role || s.role,
          messages: (msgs || [])
            .filter((m) => m.stakeholder_id === s.id)
            .map((m) => {
              const stripped = stripCompletionToken(m.content);
              const clean =
                m.role === "assistant"
                  ? parseSuggestions(stripped).cleanText || stripped
                  : stripped;
              return { role: m.role as "user" | "assistant", content: clean };
            }),
        };
      });
    }
  }

  const ctx: GenerativeContext = {
    project: { id: project.id, name: project.name, context: project.context },
    brd,
    priorDocuments,
    transcripts,
  };

  const userPrompt = generativeAgent.buildUserPrompt(ctx);

  const { text } = await generateText({
    model: groq(generativeAgent.model),
    system: generativeAgent.systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
  });

  const { data: stored, error } = await db
    .from("documents")
    .insert({
      project_id: projectId,
      agent_id: generativeAgent.id,
      kind: generativeAgent.document.kind,
      title: generativeAgent.document.title,
      content: text,
      model: generativeAgent.model,
    })
    .select("id")
    .single();

  if (error || !stored) {
    return { ok: false, reason: error?.message || "insert_failed" };
  }
  return { ok: true, documentId: stored.id };
}
