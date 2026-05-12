import { groq } from "@ai-sdk/groq";
import { streamText, type CoreMessage } from "ai";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  const agent = getConversationalAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { messages: IncomingMessage[]; token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, token } = body;
  if (!token || !messages?.length) {
    return Response.json({ error: "Missing token or messages" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: stakeholder, error: stErr } = await db
    .from("stakeholders")
    .select(
      "id, name, role, status, project_id, intake_data, conversation_ended_at, projects(name, context)"
    )
    .eq("token", token)
    .eq("agent_id", agent.id)
    .single();

  if (stErr || !stakeholder) {
    return Response.json({ error: "Invalid interview link" }, { status: 404 });
  }
  if (stakeholder.conversation_ended_at || stakeholder.status === "completed") {
    return Response.json({ error: "Interview already complete" }, { status: 410 });
  }

  const projectsField = stakeholder.projects as
    | { name: string; context: string | null }
    | { name: string; context: string | null }[]
    | null;
  const project = Array.isArray(projectsField) ? projectsField[0] : projectsField;

  const latestUser = messages[messages.length - 1];
  if (latestUser.role !== "user" || !latestUser.content?.trim()) {
    return Response.json({ error: "Last message must be a user message" }, { status: 400 });
  }

  const { error: insErr } = await db.from("messages").insert({
    stakeholder_id: stakeholder.id,
    role: "user",
    content: latestUser.content,
  });
  if (insErr) {
    return Response.json({ error: "Failed to persist message" }, { status: 500 });
  }

  if (stakeholder.status === "pending") {
    await db
      .from("stakeholders")
      .update({ status: "in_progress" })
      .eq("id", stakeholder.id);
  }

  const systemPrompt = agent.buildInterviewerSystemPrompt({
    projectContext: project?.context || "",
    intake: (stakeholder.intake_data as Record<string, string>) || {},
    stakeholder: {
      id: stakeholder.id,
      name: stakeholder.name,
      role: stakeholder.role,
    },
  });

  const coreMessages: CoreMessage[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await streamText({
      model: groq(agent.model),
      system: systemPrompt,
      messages: coreMessages,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        await db.from("messages").insert({
          stakeholder_id: stakeholder.id,
          role: "assistant",
          content: text,
        });
      },
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error("[chat] Groq error", err);
    return Response.json(
      { error: "The interviewer is temporarily unavailable. Please try again in a moment." },
      { status: 503 }
    );
  }
}
