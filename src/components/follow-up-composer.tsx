"use client";

import { useState } from "react";

type Tone =
  | "initial_response"
  | "schedule_meeting"
  | "status_update"
  | "decline"
  | "custom";

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "initial_response", label: "Initial response" },
  { value: "schedule_meeting", label: "Schedule meeting" },
  { value: "status_update",    label: "Status update" },
  { value: "decline",          label: "Polite decline" },
  { value: "custom",           label: "Custom (use my notes)" },
];

type Props = {
  agentId: string;
  stakeholderId: string;
  stakeholderEmail: string | null;
};

export function FollowUpComposer({
  agentId,
  stakeholderId,
  stakeholderEmail,
}: Props) {
  const [tone, setTone] = useState<Tone>("initial_response");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [copiedField, setCopiedField] = useState<"subject" | "body" | null>(null);

  const draft = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeholderId, tone, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Couldn't draft the email.");
      } else {
        setSubject(data.draft.subject);
        setBodyText(data.draft.body);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (field: "subject" | "body") => {
    const value = field === "subject" ? subject : bodyText;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  };

  const mailtoHref =
    stakeholderEmail && (subject || bodyText)
      ? `mailto:${stakeholderEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
      : null;

  return (
    <section className="border rounded-lg p-5 bg-white dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Draft follow-up email</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Generates a draft using the stakeholder&apos;s context and the latest BRD.
          Nothing is sent — you copy + paste into your own email client.
        </p>
      </div>

      <div className="grid sm:grid-cols-[200px_1fr] gap-3 items-start">
        <label className="text-sm font-medium pt-2">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
          className="border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm"
        >
          {TONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium pt-2">
          Notes
          {tone === "custom" && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={
            tone === "custom"
              ? "Tell the model exactly what to say…"
              : "Optional — any extra context for this draft (e.g. mention X, avoid Y)…"
          }
          className="border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={draft}
        disabled={loading || (tone === "custom" && !notes.trim())}
        className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Drafting…" : subject ? "Redraft" : "Draft email"}
      </button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {(subject || bodyText) && (
        <div className="space-y-3 pt-2 border-t dark:border-zinc-800">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Subject
              </label>
              <button
                type="button"
                onClick={() => copy("subject")}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {copiedField === "subject" ? "Copied" : "Copy"}
              </button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Body
              </label>
              <button
                type="button"
                onClick={() => copy("body")}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {copiedField === "body" ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={12}
              className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm font-mono"
            />
          </div>
          {mailtoHref && (
            <div>
              <a
                href={mailtoHref}
                className="inline-block text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800"
              >
                Open in email client →
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
