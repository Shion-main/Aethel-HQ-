"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FollowUpStatus } from "@/lib/agents/types";

const STATUSES: { value: FollowUpStatus; label: string; classes: string }[] = [
  { value: "new",          label: "New",          classes: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900" },
  { value: "interested",   label: "Interested",   classes: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900" },
  { value: "following_up", label: "Following up", classes: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900" },
  { value: "closed",       label: "Closed",       classes: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" },
  { value: "hired",        label: "Hired",        classes: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900" },
];

const lookup = (s: FollowUpStatus) => STATUSES.find((o) => o.value === s) ?? STATUSES[0];

type Props = {
  agentId: string;
  stakeholderId: string;
  status: FollowUpStatus;
};

export function StatusBadge({ agentId, stakeholderId, status }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<FollowUpStatus>(status);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const change = async (next: FollowUpStatus) => {
    if (next === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const prev = current;
    setCurrent(next);
    setOpen(false);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/stakeholders/${stakeholderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      if (!res.ok) {
        setCurrent(prev);
      } else {
        router.refresh();
      }
    } catch {
      setCurrent(prev);
    } finally {
      setSaving(false);
    }
  };

  const opt = lookup(current);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        disabled={saving}
        className={`text-xs px-2 py-0.5 rounded border ${opt.classes} disabled:opacity-50`}
      >
        {opt.label}
        <span className="ml-1 opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md shadow-lg py-1">
          {STATUSES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                change(o.value);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                o.value === current ? "font-medium" : ""
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
