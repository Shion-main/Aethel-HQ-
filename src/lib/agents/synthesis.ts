import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAgent } from "./registry";
import type { SynthesisContext, SynthesisStakeholder } from "./types";

export type SynthesisResult =
  | { ok: true; outputId: string }
  | { ok: false; reason: string };

export async function runSynthesisForProject(
  agentId: string,
  projectId: string
): Promise<SynthesisResult> {
  const agent = requireAgent(agentId);
  const db = supabaseAdmin();

  const { data: project } = await db
    .from("projects")
    .select("id, name, context, agent_id")
    .eq("id", projectId)
    .single();
  if (!project) return { ok: false, reason: "project_not_found" };
  if (project.agent_id !== agentId) {
    return { ok: false, reason: "project_belongs_to_different_agent" };
  }

  const stakeholderQuery = db
    .from("stakeholders")
    .select("id, name, role, intake_data, status")
    .eq("project_id", projectId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });

  const { data: stakeholders } = agent.synthesis.requireCompletedStakeholders
    ? await stakeholderQuery.eq("status", "completed")
    : await stakeholderQuery;

  if (!stakeholders?.length) return { ok: false, reason: "no_stakeholders" };

  const ids = stakeholders.map((s) => s.id);
  const { data: allMessages } = await db
    .from("messages")
    .select("stakeholder_id, role, content, created_at")
    .in("stakeholder_id", ids)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const synthStakeholders: SynthesisStakeholder[] = stakeholders.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    intake: (s.intake_data as Record<string, string>) || {},
    messages:
      (allMessages || [])
        .filter((m) => m.stakeholder_id === s.id)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) ||
      [],
  }));

  const ctx: SynthesisContext = {
    projectId,
    project: { name: project.name, context: project.context },
    stakeholders: synthStakeholders,
  };

  const userPrompt = agent.buildSynthesizerUserPrompt(ctx);

  const { text } = await generateText({
    model: groq(agent.model),
    system: agent.synthesizerSystemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
  });

  const { data: stored, error } = await db
    .from("documents")
    .insert({
      project_id: projectId,
      agent_id: agentId,
      kind: agent.synthesis.documentKind,
      content: text,
      model: agent.model,
    })
    .select("id")
    .single();

  if (error || !stored) return { ok: false, reason: error?.message || "insert_failed" };
  return { ok: true, outputId: stored.id };
}
