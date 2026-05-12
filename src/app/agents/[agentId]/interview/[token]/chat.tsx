"use client";

import { useEffect, useRef, useState } from "react";
import { useChat, type Message } from "ai/react";
import {
  stripCompletionToken,
  COMPLETION_TOKEN,
} from "@/lib/agents/business-analyst/types";
import {
  parseSuggestions,
  composeUserMessage,
} from "@/lib/agents/business-analyst/parse-suggestions";

const DEBUG_SUGGESTIONS = false;

type Props = {
  agentId: string;
  token: string;
  stakeholderName: string;
  projectName: string;
  isCompleted: boolean;
  initialMessages: Message[];
};

export function InterviewChat({
  agentId,
  token,
  stakeholderName,
  projectName,
  isCompleted,
  initialMessages,
}: Props) {
  const { messages, input, setInput, append, isLoading, error } = useChat({
    api: `/api/agents/${agentId}/chat`,
    body: { token },
    initialMessages,
  });

  const [selectedChips, setSelectedChips] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const completedNow =
    isCompleted ||
    messages.some(
      (m) => m.role === "assistant" && m.content.includes(COMPLETION_TOKEN)
    );

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const toggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const composed = composeUserMessage(selectedChips, input);
    if (!composed.trim()) return;
    setSelectedChips([]);
    setInput("");
    await append({ role: "user", content: composed });
  };

  const canSend =
    !isLoading && (selectedChips.length > 0 || input.trim().length > 0);

  return (
    <main className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="text-xs text-zinc-500">Stakeholder interview</div>
          <h1 className="text-lg font-semibold">
            {projectName}{" "}
            <span className="text-zinc-500 font-normal">· {stakeholderName}</span>
          </h1>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-sm text-zinc-500 text-center py-12">
              Say hi to start the interview.
            </div>
          )}
          {messages.map((m) => {
            if (m.role === "user") {
              const display = stripCompletionToken(m.content);
              if (!display) return null;
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                    {display}
                  </div>
                </div>
              );
            }

            const raw = stripCompletionToken(m.content);
            const { cleanText, suggestions } = parseSuggestions(raw);
            if (DEBUG_SUGGESTIONS && suggestions) {
              console.debug("[chips] parsed", suggestions);
            }
            const isLatestAssistant = m.id === lastAssistantId;
            const showChips =
              isLatestAssistant && suggestions && !isLoading && !completedNow;

            const displayText = cleanText || raw;
            if (!displayText && !showChips) return null;

            return (
              <div key={m.id} className="space-y-2">
                {displayText && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed bg-white border dark:bg-zinc-900 dark:border-zinc-800">
                      {displayText}
                    </div>
                  </div>
                )}
                {showChips && (
                  <div className="flex flex-wrap gap-2 ml-2 max-w-[85%]">
                    {suggestions!.map((suggestion) => {
                      const isSelected = selectedChips.includes(suggestion);
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => toggleChip(suggestion)}
                          aria-pressed={isSelected}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            isSelected
                              ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                              : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-500"
                          }`}
                        >
                          {isSelected ? "✓ " : ""}
                          {suggestion}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl px-4 py-2.5 text-sm text-zinc-400">
                …
              </div>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-4 py-2">
              Something went wrong. Try sending your last message again.
            </div>
          )}
          {completedNow && (
            <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-md px-4 py-3 text-center">
              Thanks — your interview is complete. You can close this tab.
            </div>
          )}
        </div>
      </div>

      {!completedNow && (
        <form
          onSubmit={onSubmit}
          className="border-t dark:border-zinc-800 bg-white dark:bg-zinc-950"
        >
          <div className="max-w-3xl mx-auto px-6 py-3 space-y-2">
            {selectedChips.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-md text-sm">
                <span className="text-zinc-500 text-xs">Selected:</span>
                {selectedChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1 bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-full px-2 py-0.5"
                  >
                    <span className="font-medium text-xs">{chip}</span>
                    <button
                      type="button"
                      onClick={() => toggleChip(chip)}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 leading-none"
                      aria-label={`Remove ${chip}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedChips.length > 0
                    ? "Add more in your own words (optional)…"
                    : "Type your answer…"
                }
                disabled={isLoading}
                className="flex-1 border rounded-md px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-800 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
}
