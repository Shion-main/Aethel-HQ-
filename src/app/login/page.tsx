import { redirect } from "next/navigation";
import { checkPassword, isAdmin, setAdminCookie } from "@/lib/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  if (isAdmin()) redirect(searchParams.next || "/agents/business-analyst/admin");

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") || "");
    const next = String(formData.get("next") || "/agents/business-analyst/admin");
    if (!checkPassword(password)) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
    setAdminCookie();
    redirect(next);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
      <form action={login} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin login</h1>
          <p className="text-sm text-zinc-500 mt-1">Aethel HQ — single-user gate.</p>
        </div>
        <input type="hidden" name="next" value={searchParams.next || ""} />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoFocus
          required
          className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-800"
        />
        {searchParams.error && (
          <p className="text-sm text-red-600">Wrong password.</p>
        )}
        <button
          type="submit"
          className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md py-2 font-medium"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
