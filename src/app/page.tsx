import Link from "next/link";
import { listAgents } from "@/lib/agents/registry";

export default function Home() {
  const agents = listAgents("conversational");
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-xl w-full space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Aethel HQ</h1>
          <p className="text-sm text-zinc-500 mt-1">Internal agent platform — Aethel Labs.</p>
        </div>
        <div className="border rounded-lg divide-y dark:border-zinc-800 dark:divide-zinc-800">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}/admin`}
              className="flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-zinc-500">{a.shortDescription}</div>
              </div>
              <span className="text-zinc-400">→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
