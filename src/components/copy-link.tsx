"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 ml-2"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
