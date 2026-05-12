"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export type DocumentRecord = {
  id: string;
  content: string;
  created_at: string;
  kind?: string;
  title?: string | null;
};

type Props = {
  documentLabel: string;          // "Business Requirements Document", "Statement of Work"
  endpointPath: string;           // POST endpoint that triggers generation, e.g. /api/agents/business-analyst/synthesize
  endpointBody?: Record<string, unknown>;  // extra body fields beyond { projectId }
  projectId: string;
  initialDocument: DocumentRecord | null;
  canGenerate: boolean;
  enabledHelperText: string;      // shown when canGenerate is true
  disabledHelperText: string;     // shown when canGenerate is false
  ctaGenerate: string;            // "Generate BRD", "Generate SOW"
  ctaRegenerate: string;          // "Regenerate"
  generatingHelperText: string;   // shown while loading
};

export function DocumentPanel({
  documentLabel,
  endpointPath,
  endpointBody = {},
  projectId,
  initialDocument,
  canGenerate,
  enabledHelperText,
  disabledHelperText,
  ctaGenerate,
  ctaRegenerate,
  generatingHelperText,
}: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null>(initialDocument);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...endpointBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Failed to generate ${documentLabel}.`);
      } else {
        const result = (data.document || data.brd) as DocumentRecord | undefined;
        if (result) setDoc(result);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(doc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">{documentLabel}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {canGenerate ? enabledHelperText : disabledHelperText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && (
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
            {loading ? "Generating…" : doc ? ctaRegenerate : ctaGenerate}
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
          {generatingHelperText}
        </div>
      )}

      {!loading && doc && (
        <article className="border rounded-lg p-6 bg-white dark:bg-zinc-900 dark:border-zinc-800 prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-table:text-sm">
          <ReactMarkdown>{doc.content}</ReactMarkdown>
          <p className="text-xs text-zinc-400 mt-6 not-prose">
            Generated {new Date(doc.created_at).toLocaleString()}
          </p>
        </article>
      )}

      {!loading && !doc && (
        <div className="text-sm text-zinc-500 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-6 text-center">
          No {documentLabel.toLowerCase()} generated yet.
        </div>
      )}
    </section>
  );
}
