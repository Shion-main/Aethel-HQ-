"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeField } from "@/lib/agents/types";

type Props = {
  agentId: string;
  token: string;
  fields: IntakeField[];
  defaults: Record<string, string>;
  projectName: string;
};

export function IntakeForm({ agentId, token, fields, defaults, projectName }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    fields.forEach((f) => {
      seed[f.key] = defaults[f.key] ?? "";
    });
    return seed;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} is required.`);
        return;
      }
      if (f.type === "email" && values[f.key]) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.key]);
        if (!ok) {
          setError(`${f.label} doesn't look like a valid email.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Couldn't save your details. Please try again.");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="text-xs text-zinc-500">Before we start</div>
          <h1 className="text-lg font-semibold">{projectName}</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            Could you share a few details so we know who we&apos;re chatting with? This
            takes about 30 seconds.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label htmlFor={`intake-${f.key}`} className="block text-sm font-medium">
                  {f.label}
                  {f.required && <span className="text-red-600 ml-0.5">*</span>}
                </label>
                {f.helpText && (
                  <p className="text-xs text-zinc-500">{f.helpText}</p>
                )}
                {f.type === "textarea" ? (
                  <textarea
                    id={`intake-${f.key}`}
                    name={f.key}
                    rows={3}
                    required={f.required}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-800"
                  />
                ) : (
                  <input
                    id={`intake-${f.key}`}
                    name={f.key}
                    type={f.type}
                    required={f.required}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    className="w-full border rounded-md px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-800"
                  />
                )}
              </div>
            ))}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-4 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md py-2.5 font-medium disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Start the conversation"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
