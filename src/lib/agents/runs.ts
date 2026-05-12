import { supabaseAdmin } from "@/lib/supabase/server";

export type RunKind = "synthesis" | "generative";

export type StartRunResult =
  | { ok: true; runId: string; startedAt: number }
  | { ok: false; reason: "already_running" }
  | { ok: false; reason: "insert_failed"; error: string };

/**
 * Inserts a 'running' row, relying on the unique partial index
 * uq_agent_runs_running to reject concurrent generations of the same
 * (agent, project, kind) tuple.
 */
export async function startRun(
  agentId: string,
  projectId: string,
  kind: RunKind
): Promise<StartRunResult> {
  const db = supabaseAdmin();
  const startedAt = Date.now();
  const { data, error } = await db
    .from("agent_runs")
    .insert({ agent_id: agentId, project_id: projectId, kind, status: "running" })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, reason: "already_running" };
    }
    return { ok: false, reason: "insert_failed", error: error.message };
  }
  return { ok: true, runId: data.id, startedAt };
}

export async function completeRun(
  runId: string,
  documentId: string,
  startedAt: number
): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("agent_runs")
    .update({
      status: "completed",
      document_id: documentId,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    })
    .eq("id", runId);
}

export async function failRun(
  runId: string,
  errorMessage: string,
  startedAt: number
): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("agent_runs")
    .update({
      status: "failed",
      error: errorMessage.slice(0, 2000),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    })
    .eq("id", runId);
}
