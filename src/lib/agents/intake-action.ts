"use server";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "./registry";

export type IntakeActionState = { error: string | null };

export async function submitIntakeAction(
  _prev: IntakeActionState,
  formData: FormData
): Promise<IntakeActionState> {
  const agentId = String(formData.get("__agentId") || "");
  const token = String(formData.get("__token") || "");

  const agent = getConversationalAgent(agentId);
  if (!agent) return { error: "Unknown agent." };
  if (!token) return { error: "Missing token." };

  const clean: Record<string, string> = {};
  for (const field of agent.intakeSchema) {
    const raw = String(formData.get(field.key) || "").trim();
    if (field.required && !raw) {
      return { error: `${field.label} is required.` };
    }
    if (field.maxLength && raw.length > field.maxLength) {
      return { error: `${field.label} is too long.` };
    }
    if (field.type === "email" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return { error: `${field.label} doesn't look like a valid email.` };
    }
    if (raw) clean[field.key] = raw;
  }

  const db = supabaseAdmin();

  const { data: stakeholder, error: stErr } = await db
    .from("stakeholders")
    .select(
      "id, project_id, conversation_ended_at, projects(name, context)"
    )
    .eq("token", token)
    .eq("agent_id", agent.id)
    .single();

  if (stErr || !stakeholder) {
    return { error: "Invalid interview link." };
  }
  if (stakeholder.conversation_ended_at) {
    return { error: "This conversation is already complete." };
  }

  const updates: Record<string, unknown> = {
    intake_data: clean,
    intake_completed_at: new Date().toISOString(),
  };
  if (clean.name) updates.name = clean.name;
  if (clean.role) updates.role = clean.role;
  if (clean.email) updates.email = clean.email;
  if (clean.company) updates.company = clean.company;

  const { error: upErr } = await db
    .from("stakeholders")
    .update(updates)
    .eq("id", stakeholder.id);

  if (upErr) {
    return { error: upErr.message };
  }

  // Pre-generate the agent's greeting so the stakeholder lands on a populated
  // chat. Non-fatal: if Groq errors, intake still succeeds and the chat will
  // start empty (stakeholder can type "hi" to kick the model off).
  try {
    // Only generate if no assistant message exists yet (idempotent on resubmits)
    const { data: existing } = await db
      .from("messages")
      .select("id")
      .eq("stakeholder_id", stakeholder.id)
      .eq("role", "assistant")
      .limit(1);

    if (!existing?.length) {
      const projectsField = stakeholder.projects as
        | { name: string; context: string | null }
        | { name: string; context: string | null }[]
        | null;
      const project = Array.isArray(projectsField)
        ? projectsField[0]
        : projectsField;

      const systemPrompt = agent.buildInterviewerSystemPrompt({
        projectContext: project?.context || "",
        intake: clean,
        stakeholder: {
          id: stakeholder.id,
          name: clean.name,
          role: clean.role,
        },
      });

      const { text: greeting } = await generateText({
        model: google(agent.model),
        system: systemPrompt,
        prompt: "Begin the conversation now with your opening greeting.",
        temperature: 0.7,
      });

      if (greeting?.trim()) {
        await db.from("messages").insert({
          stakeholder_id: stakeholder.id,
          role: "assistant",
          content: greeting,
        });
      }
    }
  } catch (err) {
    console.error("[intake] greeting pre-generation failed (non-fatal)", err);
  }

  const path = `/agents/${agent.id}/interview/${token}`;
  revalidatePath(path);
  redirect(path);
}
