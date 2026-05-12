import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/registry";
import { CopyLink } from "@/components/copy-link";
import { BrdPanel } from "@/components/brd-panel";
import type { Project, Stakeholder, Brd } from "@/lib/agents/business-analyst/types";

async function addStakeholder(formData: FormData) {
  "use server";
  const agentId = String(formData.get("agentId") || "");
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim();
  if (!agentId || !getAgent(agentId)) throw new Error("Unknown agent");
  if (!projectId) return;
  const db = supabaseAdmin();
  const { error } = await db.from("stakeholders").insert({
    project_id: projectId,
    agent_id: agentId,
    name: name || "Stakeholder",
    role: role || null,
    token: nanoid(21),
    intake_completed_at: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/agents/${agentId}/admin/${projectId}`);
}

const STATUS_BADGE: Record<Stakeholder["status"], string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export default async function ProjectDetail({
  params,
}: {
  params: { agentId: string; projectId: string };
}) {
  const agent = getAgent(params.agentId);
  if (!agent) notFound();

  const db = supabaseAdmin();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .eq("agent_id", agent.id)
    .single();

  if (!project) notFound();

  const { data: stakeholders } = await db
    .from("stakeholders")
    .select("*")
    .eq("project_id", params.projectId)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true });

  const counts: Record<string, number> = {};
  if (stakeholders?.length) {
    const ids = stakeholders.map((s) => s.id);
    const { data: msgs } = await db
      .from("messages")
      .select("stakeholder_id")
      .in("stakeholder_id", ids);
    msgs?.forEach((m) => {
      counts[m.stakeholder_id] = (counts[m.stakeholder_id] || 0) + 1;
    });
  }

  const { data: latestBrd } = await db
    .from("brds")
    .select("id, content, created_at")
    .eq("project_id", params.projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const completedCount =
    (stakeholders as Stakeholder[] | null)?.filter((s) => s.status === "completed").length ||
    0;

  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3001";
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;

  const p = project as Project;

  return (
    <div className="space-y-8">
      <section>
        <Link
          href={`/agents/${agent.id}/admin`}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All projects
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{p.name}</h1>
        {p.context && (
          <p className="text-sm text-zinc-500 mt-2 whitespace-pre-wrap">{p.context}</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add stakeholder</h2>
        <p className="text-xs text-zinc-500 mb-2">
          Name and role are optional pre-fills — the stakeholder will confirm their own contact info on the intake form before chatting.
        </p>
        <form
          action={addStakeholder}
          className="flex flex-col sm:flex-row gap-2 border rounded-lg p-4 bg-white dark:bg-zinc-900 dark:border-zinc-800"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <input type="hidden" name="projectId" value={p.id} />
          <input
            name="name"
            placeholder="Name (optional pre-fill)"
            className="flex-1 border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800"
          />
          <input
            name="role"
            placeholder="Role (optional pre-fill)"
            className="flex-1 border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800"
          />
          <button className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium">
            Add
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Stakeholders</h2>
        {!stakeholders?.length ? (
          <p className="text-sm text-zinc-500">No stakeholders yet.</p>
        ) : (
          <ul className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {(stakeholders as Stakeholder[]).map((s) => {
              const url = `${baseUrl}/agents/${agent.id}/interview/${s.token}`;
              const msgCount = counts[s.id] || 0;
              return (
                <li key={s.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/agents/${agent.id}/admin/${p.id}/stakeholders/${s.id}`}
                      className="flex-1 hover:opacity-80"
                    >
                      <div className="font-medium">
                        {s.name}
                        {s.role && (
                          <span className="text-zinc-500 font-normal"> · {s.role}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {msgCount} message{msgCount === 1 ? "" : "s"}
                        {msgCount > 0 && " · view transcript"}
                      </div>
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[s.status]}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-zinc-500 font-mono bg-zinc-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded px-2 py-1">
                    <span className="truncate flex-1">{url}</span>
                    <CopyLink url={url} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BrdPanel
        agentId={agent.id}
        projectId={p.id}
        initialBrd={(latestBrd as Brd | null) || null}
        canGenerate={completedCount > 0}
        completedCount={completedCount}
      />
    </div>
  );
}
