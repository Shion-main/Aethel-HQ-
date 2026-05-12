import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } }
) {
  const agent = getConversationalAgent(params.agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: { token?: string; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, values } = body;
  if (!token || !values || typeof values !== "object") {
    return Response.json({ error: "Missing token or values" }, { status: 400 });
  }

  // Validate against agent's intake schema
  const clean: Record<string, string> = {};
  for (const field of agent.intakeSchema) {
    const raw = (values[field.key] ?? "").toString().trim();
    if (field.required && !raw) {
      return Response.json(
        { error: `${field.label} is required.` },
        { status: 400 }
      );
    }
    if (field.maxLength && raw.length > field.maxLength) {
      return Response.json(
        { error: `${field.label} is too long.` },
        { status: 400 }
      );
    }
    if (field.type === "email" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return Response.json(
        { error: `${field.label} doesn't look like a valid email.` },
        { status: 400 }
      );
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
    return Response.json({ error: "Invalid interview link" }, { status: 404 });
  }
  if (stakeholder.conversation_ended_at) {
    return Response.json({ error: "Interview already complete" }, { status: 410 });
  }

  // Promote two universal contact fields to dedicated columns if present;
  // store full intake submission in intake_data jsonb.
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
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
