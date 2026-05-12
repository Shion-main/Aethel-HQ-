import Link from "next/link";
import { requireAdmin, clearAdminCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireAdmin();

  async function logout() {
    "use server";
    clearAdminCookie();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Aethel HQ
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <Link href="/agents/business-analyst/admin" className="text-sm font-medium">
              Business Analyst
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
