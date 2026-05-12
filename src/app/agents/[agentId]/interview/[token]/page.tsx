import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";
import { IntakeForm } from "@/components/intake-form";
import { InterviewChat } from "./chat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: { agentId: string; token: string };
}) {
  const agent = getAgent(params.agentId);
  if (!agent) notFound();

  const db = supabaseAdmin();
  const { data: stakeholder } = await db
    .from("stakeholders")
    .select("*, projects(name, context)")
    .eq("token", params.token)
    .eq("agent_id", agent.id)
    .single();

  if (!stakeholder) notFound();

  const projectsField = stakeholder.projects as
    | { name: string; context: string | null }
    | { name: string; context: string | null }[]
    | null;
  const project = Array.isArray(projectsField) ? projectsField[0] : projectsField;
  const projectName = project?.name || "this project";

  // Intake gate: NULL intake_completed_at → show intake form
  if (!stakeholder.intake_completed_at) {
    const intakeData = (stakeholder.intake_data as Record<string, string>) || {};
    const defaults: Record<string, string> = { ...intakeData };
    // Pre-fill from admin's pre-supplied name/role if intake hasn't captured them
    if (!defaults.name && stakeholder.name) defaults.name = stakeholder.name;
    if (!defaults.role && stakeholder.role) defaults.role = stakeholder.role;

    return (
      <IntakeForm
        agentId={agent.id}
        token={params.token}
        fields={agent.intakeSchema}
        defaults={defaults}
        projectName={projectName}
      />
    );
  }

  const { data: messages } = await db
    .from("messages")
    .select("id, role, content")
    .eq("stakeholder_id", stakeholder.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const initialMessages = (messages || []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: stripCompletionToken(m.content),
  }));

  const intakeData = (stakeholder.intake_data as Record<string, string>) || {};
  const displayName = intakeData.name || stakeholder.name;

  return (
    <InterviewChat
      agentId={agent.id}
      token={params.token}
      stakeholderName={displayName}
      projectName={projectName}
      isCompleted={
        !!stakeholder.conversation_ended_at || stakeholder.status === "completed"
      }
      initialMessages={initialMessages}
    />
  );
}
