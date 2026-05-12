import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin, clearAdminCookie } from "@/lib/auth";
import { getConversationalAgent } from "@/lib/agents/registry";

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { agentId: string };
}) {
  requireAdmin();

  const agent = getConversationalAgent(params.agentId);
  if (!agent) notFound();

  async function logout() {
    "use server";
    clearAdminCookie();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Aethel HQ
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <Link href={`/agents/${agent.id}/admin`} className="text-sm font-medium">
              {agent.name}
            </Link>
          </div>
          <form action={logout}>
            <button className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
