import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";

type ProjectStatus =
  | "intake_pending"
  | "in_conversation"
  | "awaiting_brd"
  | "has_brd";

const STATUS_META: Record<ProjectStatus, { label: string; classes: string }> = {
  intake_pending: {
    label: "intake pending",
    classes: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  in_conversation: {
    label: "in conversation",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  awaiting_brd: {
    label: "awaiting BRD",
    classes: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  has_brd: {
    label: "has BRD",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

async function inviteStakeholder(formData: FormData) {
  "use server";
  const agentId = String(formData.get("agentId") || "");
  if (!agentId || !getAgent(agentId)) throw new Error("Unknown agent");

  const db = supabaseAdmin();
  const now = new Date();
  const placeholder = `Untitled session · ${now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;

  const { data: project, error: pErr } = await db
    .from("projects")
    .insert({ name: placeholder, context: null, agent_id: agentId })
    .select("id")
    .single();
  if (pErr || !project) {
    throw new Error(pErr?.message || "Failed to create project");
  }

  const { error: sErr } = await db.from("stakeholders").insert({
    project_id: project.id,
    agent_id: agentId,
    name: "Stakeholder",
    role: null,
    token: nanoid(21),
    intake_completed_at: null,
  });
  if (sErr) throw new Error(sErr.message);

  revalidatePath(`/agents/${agentId}/admin`);
  redirect(`/agents/${agentId}/admin/${project.id}`);
}

export default async function AdminHome({
  params,
}: {
  params: { agentId: string };
}) {
  const agent = getAgent(params.agentId);
  if (!agent) notFound();

  const db = supabaseAdmin();

  const { data: projects } = await db
    .from("projects")
    .select("id, name, context, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  // Batch-fetch derived status info
  const projectIds = (projects || []).map((p) => p.id);
  const [{ data: stakeholders }, { data: docs }] = projectIds.length
    ? await Promise.all([
        db
          .from("stakeholders")
          .select("project_id, intake_completed_at, status")
          .in("project_id", projectIds),
        db
          .from("documents")
          .select("project_id")
          .eq("kind", "brd")
          .in("project_id", projectIds),
      ])
    : [{ data: [] }, { data: [] }];

  const brdSet = new Set((docs || []).map((b) => b.project_id));
  const statusByProject: Record<string, ProjectStatus> = {};
  for (const id of projectIds) {
    const stk = (stakeholders || []).filter((s) => s.project_id === id);
    if (brdSet.has(id)) {
      statusByProject[id] = "has_brd";
    } else if (stk.some((s) => s.status === "completed")) {
      statusByProject[id] = "awaiting_brd";
    } else if (stk.some((s) => s.status === "in_progress" || s.intake_completed_at)) {
      statusByProject[id] = "in_conversation";
    } else {
      statusByProject[id] = "intake_pending";
    }
  }

  return (
    <div className="space-y-8">
      <section className="border rounded-lg p-5 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Invite a stakeholder</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Generates a session link. The project will be created automatically
              after the conversation ends.
            </p>
          </div>
          <form action={inviteStakeholder}>
            <input type="hidden" name="agentId" value={agent.id} />
            <button className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium">
              + Invite stakeholder
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {!projects?.length ? (
          <p className="text-sm text-zinc-500">
            No projects yet. Invite a stakeholder above to start.
          </p>
        ) : (
          <ul className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {projects.map((p) => {
              const status = statusByProject[p.id] || "intake_pending";
              const meta = STATUS_META[status];
              return (
                <li key={p.id}>
                  <Link
                    href={`/agents/${agent.id}/admin/${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      {p.context && (
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                          {p.context}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${meta.classes}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-zinc-400">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
