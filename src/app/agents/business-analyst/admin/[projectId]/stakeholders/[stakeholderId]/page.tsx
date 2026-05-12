import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  stripCompletionToken,
  type Message,
  type Stakeholder,
} from "@/lib/agents/business-analyst/types";
import { parseSuggestions } from "@/lib/agents/business-analyst/parse-suggestions";

export default async function TranscriptPage({
  params,
}: {
  params: { projectId: string; stakeholderId: string };
}) {
  const db = supabaseAdmin();
  const { data: stakeholder } = await db
    .from("stakeholders")
    .select("*")
    .eq("id", params.stakeholderId)
    .eq("project_id", params.projectId)
    .single();

  if (!stakeholder) notFound();

  const { data: messages } = await db
    .from("messages")
    .select("*")
    .eq("stakeholder_id", params.stakeholderId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const s = stakeholder as Stakeholder;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/agents/business-analyst/admin/${params.projectId}`}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to project
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {s.name}
          {s.role && <span className="text-zinc-500 font-normal"> · {s.role}</span>}
        </h1>
        <div className="text-xs text-zinc-500 mt-1">
          Status: <span className="font-medium">{s.status.replace("_", " ")}</span>
          {s.completed_at && (
            <> · completed {new Date(s.completed_at).toLocaleString()}</>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {!messages?.length ? (
          <p className="text-sm text-zinc-500">No messages yet.</p>
        ) : (
          (messages as Message[]).map((m) => {
            const stripped = stripCompletionToken(m.content);
            const content =
              m.role === "assistant"
                ? parseSuggestions(stripped).cleanText || stripped
                : stripped;
            if (!content) return null;
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    isUser
                      ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-white border dark:bg-zinc-900 dark:border-zinc-800"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                    {isUser ? s.name : "Interviewer"}
                  </div>
                  {content}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
