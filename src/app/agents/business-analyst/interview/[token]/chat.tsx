"use client";

import { useEffect, useRef } from "react";
import { useChat, type Message } from "ai/react";
import { stripCompletionToken, COMPLETION_TOKEN } from "@/lib/agents/business-analyst/types";

type Props = {
  token: string;
  stakeholderName: string;
  projectName: string;
  isCompleted: boolean;
  initialMessages: Message[];
};

export function InterviewChat({
  token,
  stakeholderName,
  projectName,
  isCompleted,
  initialMessages,
}: Props) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/agents/business-analyst/chat",
    body: { token },
    initialMessages,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const completedNow =
    isCompleted ||
    messages.some((m) => m.role === "assistant" && m.content.includes(COMPLETION_TOKEN));

  return (
    <main className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="text-xs text-zinc-500">Stakeholder interview</div>
          <h1 className="text-lg font-semibold">
            {projectName} <span className="text-zinc-500 font-normal">· {stakeholderName}</span>
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
            const display = stripCompletionToken(m.content);
            if (!display) return null;
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    isUser
                      ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-white border dark:bg-zinc-900 dark:border-zinc-800"
                  }`}
                >
                  {display}
                </div>
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
          onSubmit={handleSubmit}
          className="border-t dark:border-zinc-800 bg-white dark:bg-zinc-950"
        >
          <div className="max-w-3xl mx-auto px-6 py-3 flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your answer…"
              disabled={isLoading}
              className="flex-1 border rounded-md px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-800 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
