"use server";

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
    .select("id, conversation_ended_at")
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

  const path = `/agents/${agent.id}/interview/${token}`;
  revalidatePath(path);
  redirect(path);
}
