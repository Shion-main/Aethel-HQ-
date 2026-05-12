"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatPHDateTime } from "@/lib/format-date";

export type DocumentRecord = {
  id: string;
  content: string;
  edited_content?: string | null;
  edited_at?: string | null;
  human_edited?: boolean;
  created_at: string;
  kind?: string;
  title?: string | null;
};

type Props = {
  agentId: string;
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

const displayContent = (doc: DocumentRecord) =>
  doc.edited_content ?? doc.content;

export function DocumentPanel({
  agentId,
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

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
      await navigator.clipboard.writeText(displayContent(doc));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const startEdit = () => {
    if (!doc) return;
    setDraft(displayContent(doc));
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
  };

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/documents/${doc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to save edits.");
      } else {
        if (data.document) setDoc(data.document as DocumentRecord);
        setEditing(false);
        setDraft("");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!doc || !doc.human_edited) return;
    if (!confirm("Discard edits and restore the AI-generated version?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/documents/${doc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revert: true }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to revert.");
      } else {
        if (data.document) setDoc(data.document as DocumentRecord);
        setEditing(false);
        setDraft("");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {documentLabel}
            {doc?.human_edited && !editing && (
              <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Edited
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {canGenerate ? enabledHelperText : disabledHelperText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && !editing && (
            <>
              <button
                onClick={copy}
                className="text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={startEdit}
                className="text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800"
              >
                Edit
              </button>
            </>
          )}
          {!editing && (
            <button
              onClick={generate}
              disabled={!canGenerate || loading}
              className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Generating…" : doc ? ctaRegenerate : ctaGenerate}
            </button>
          )}
          {editing && (
            <>
              {doc?.human_edited && (
                <button
                  onClick={revert}
                  disabled={saving}
                  className="text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800 disabled:opacity-50"
                >
                  Revert to AI version
                </button>
              )}
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="text-sm border rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !draft.trim()}
                className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
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

      {!loading && doc && editing && (
        <div className="border rounded-lg bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            className="w-full min-h-[400px] font-mono text-sm p-4 bg-transparent outline-none resize-y disabled:opacity-50"
            spellCheck={false}
          />
          <div className="text-xs text-zinc-400 px-4 py-2 border-t dark:border-zinc-800">
            Markdown. Your edits override the AI version everywhere this document is read.
          </div>
        </div>
      )}

      {!loading && doc && !editing && (
        <article className="border rounded-lg p-6 bg-white dark:bg-zinc-900 dark:border-zinc-800 prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-table:text-sm">
          <ReactMarkdown>{displayContent(doc)}</ReactMarkdown>
          <p className="text-xs text-zinc-400 mt-6 not-prose">
            Generated {formatPHDateTime(doc.created_at)}
            {doc.human_edited && doc.edited_at && (
              <> · Edited {formatPHDateTime(doc.edited_at)}</>
            )}
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
