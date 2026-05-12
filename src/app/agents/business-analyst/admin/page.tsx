import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Project } from "@/lib/agents/business-analyst/types";

async function createProject(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const context = String(formData.get("context") || "").trim();
  if (!name) return;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("projects")
    .insert({ name, context: context || null })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create project");
  revalidatePath("/agents/business-analyst/admin");
  redirect(`/agents/business-analyst/admin/${data.id}`);
}

export default async function AdminHome() {
  const db = supabaseAdmin();
  const { data: projects } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">New project</h2>
        <form action={createProject} className="space-y-3 border rounded-lg p-4 bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <input
            name="name"
            required
            placeholder="Project name (e.g. Korte Tournament Booking)"
            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800"
          />
          <textarea
            name="context"
            rows={4}
            placeholder="Project context — describe what's being built, why, who it's for. The interviewer will use this to ground its questions."
            className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800"
          />
          <button className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium">
            Create project
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {!projects?.length ? (
          <p className="text-sm text-zinc-500">No projects yet.</p>
        ) : (
          <ul className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {(projects as Project[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/agents/business-analyst/admin/${p.id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.context && (
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{p.context}</div>
                    )}
                  </div>
                  <span className="text-zinc-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
