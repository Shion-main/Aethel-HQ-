"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Props = {
  projectId: string;
  initialBrd: { id: string; content: string; created_at: string } | null;
  canGenerate: boolean;
  completedCount: number;
};

export function BrdPanel({ projectId, initialBrd, canGenerate, completedCount }: Props) {
  const router = useRouter();
  const [brd, setBrd] = useState(initialBrd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/business-analyst/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to generate BRD.");
      } else {
        setBrd(data.brd);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!brd) return;
    try {
      await navigator.clipboard.writeText(brd.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Business Requirements Document</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {canGenerate
              ? `${completedCount} completed stakeholder interview${completedCount === 1 ? "" : "s"} available.`
              : "Generation unlocks after at least one stakeholder completes their interview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {brd && (
            <button
              onClick={copy}
              className="text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            onClick={generate}
            disabled={!canGenerate || loading}
            className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Generating…" : brd ? "Regenerate" : "Generate BRD"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-4 py-2 mb-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-zinc-500 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6">
          The synthesizer is reading transcripts and writing the BRD. This usually takes 15–45 seconds.
        </div>
      )}

      {!loading && brd && (
        <article className="border rounded-lg p-6 bg-white dark:bg-zinc-900 dark:border-zinc-800 prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-table:text-sm">
          <ReactMarkdown>{brd.content}</ReactMarkdown>
          <p className="text-xs text-zinc-400 mt-6 not-prose">
            Generated {new Date(brd.created_at).toLocaleString()}
          </p>
        </article>
      )}

      {!loading && !brd && (
        <div className="text-sm text-zinc-500 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 text-center">
          No BRD generated yet.
        </div>
      )}
    </section>
  );
}
