import type { ConversationalAgent } from "@/lib/agents/types";
import {
  buildInterviewerPrompt,
  SYNTHESIZER_SYSTEM_PROMPT,
} from "@/lib/agents/business-analyst/prompts";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";
import { parseSuggestions } from "@/lib/agents/business-analyst/parse-suggestions";

export const businessAnalystConfig: ConversationalAgent = {
  id: "business-analyst",
  name: "Business Analyst",
  shortDescription: "Stakeholder interviews → BRD drafts",
  kind: "conversational",

  model: "llama-3.3-70b-versatile",

  intakeSchema: [
    { key: "name",    label: "Your name",              type: "text",  required: true,  maxLength: 120 },
    { key: "email",   label: "Email",                  type: "email", required: true,  maxLength: 200 },
    { key: "company", label: "Company / Organization", type: "text",  required: true,  maxLength: 200 },
    { key: "role",    label: "Role / Title",           type: "text",  required: true,  maxLength: 200 },
  ],

  buildInterviewerSystemPrompt: ({ projectContext, intake, stakeholder }) =>
    buildInterviewerPrompt({
      projectContext,
      stakeholderName: intake.name || stakeholder.name || "",
      stakeholderRole: intake.role || stakeholder.role || "",
    }),

  synthesizerSystemPrompt: SYNTHESIZER_SYSTEM_PROMPT,

  buildSynthesizerUserPrompt: (ctx) => {
    const transcripts = ctx.stakeholders
      .map((s) => {
        const displayName = s.intake.name || s.name;
        const displayRole = s.intake.role || s.role;
        const turns = s.messages
          .map((m) => {
            const speaker = m.role === "user" ? displayName : "Interviewer";
            const stripped = stripCompletionToken(m.content);
            const clean =
              m.role === "assistant"
                ? parseSuggestions(stripped).cleanText || stripped
                : stripped;
            return `${speaker}: ${clean}`;
          })
          .join("\n\n");
        return `## Stakeholder: ${displayName}${displayRole ? ` (${displayRole})` : ""}\n\n${turns}`;
      })
      .join("\n\n---\n\n");

    return `# Project context\n\n${ctx.project.context || "(none provided)"}\n\n# Transcripts\n\n${transcripts}\n\nProduce the BRD now. Use "${ctx.project.name}" as the project name in the title.`;
  },

  synthesis: {
    kind: "brd",
    documentKind: "brd",
    requireCompletedStakeholders: true,
  },

  endConversation: {
    cta: "End Conversation",
    confirmText: "End this interview now? You won’t be able to add more messages.",
    thankYou:
      "Thanks — your conversation is complete. The Aethel Labs team will review it and may follow up.",
  },
};
