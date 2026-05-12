import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getConversationalAgent } from "@/lib/agents/registry";
import {
  stripCompletionToken,
  type Message,
  type Stakeholder,
} from "@/lib/agents/business-analyst/types";
import { parseSuggestions } from "@/lib/agents/business-analyst/parse-suggestions";
import { StatusBadge } from "@/components/status-badge";
import { FollowUpComposer } from "@/components/follow-up-composer";
import type { FollowUpStatus } from "@/lib/agents/types";

type StakeholderWithIntake = Stakeholder & {
  email: string | null;
  company: string | null;
  intake_data: Record<string, string> | null;
  follow_up_status: FollowUpStatus;
  conversation_ended_at: string | null;
};

export default async function TranscriptPage({
  params,
}: {
  params: { agentId: string; projectId: string; stakeholderId: string };
}) {
  const agent = getConversationalAgent(params.agentId);
  if (!agent) notFound();

  const db = supabaseAdmin();
  const { data: stakeholder } = await db
    .from("stakeholders")
    .select("*")
    .eq("id", params.stakeholderId)
    .eq("project_id", params.projectId)
    .eq("agent_id", agent.id)
    .single();

  if (!stakeholder) notFound();

  const { data: messages } = await db
    .from("messages")
    .select("*")
    .eq("stakeholder_id", params.stakeholderId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const s = stakeholder as StakeholderWithIntake;
  const intake = s.intake_data || {};
  const displayName = intake.name || s.name;
  const displayRole = intake.role || s.role;
  const company = s.company || intake.company || null;
  const email = s.email || intake.email || null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/agents/${agent.id}/admin/${params.projectId}`}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to project
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-semibold">
              {displayName}
              {displayRole && (
                <span className="text-zinc-500 font-normal"> · {displayRole}</span>
              )}
            </h1>
            {(company || email) && (
              <div className="text-sm text-zinc-500 mt-1 flex flex-wrap gap-x-3">
                {company && <span>{company}</span>}
                {email && (
                  <a href={`mailto:${email}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
                    {email}
                  </a>
                )}
              </div>
            )}
            <div className="text-xs text-zinc-500 mt-2">
              Conversation: <span className="font-medium">{s.status.replace("_", " ")}</span>
              {s.conversation_ended_at && (
                <> · ended {new Date(s.conversation_ended_at).toLocaleString()}</>
              )}
            </div>
          </div>
          <StatusBadge
            agentId={agent.id}
            stakeholderId={s.id}
            status={s.follow_up_status || "new"}
          />
        </div>
      </div>

      <FollowUpComposer
        agentId={agent.id}
        stakeholderId={s.id}
        stakeholderEmail={email}
      />

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
                    {isUser ? displayName : "Interviewer"}
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
