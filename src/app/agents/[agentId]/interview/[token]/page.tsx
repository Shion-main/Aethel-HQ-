import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";
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

  return (
    <InterviewChat
      agentId={agent.id}
      token={params.token}
      stakeholderName={stakeholder.name}
      projectName={
        (Array.isArray(stakeholder.projects)
          ? stakeholder.projects[0]?.name
          : (stakeholder.projects as { name: string } | null)?.name) || "this project"
      }
      isCompleted={stakeholder.status === "completed"}
      initialMessages={initialMessages}
    />
  );
}
