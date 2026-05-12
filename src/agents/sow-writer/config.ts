import type { GenerativeAgent } from "@/lib/agents/types";
import { SOW_SYSTEM_PROMPT, buildSowUserPrompt } from "./prompts";

export const sowWriterConfig: GenerativeAgent = {
  id: "sow-writer",
  name: "SOW Writer",
  shortDescription: "Turns a BRD into a Statement of Work",
  kind: "generative",

  model: "llama-3.3-70b-versatile",

  document: {
    kind: "sow",
    label: "SOW",
    title: "Statement of Work",
  },

  inputs: {
    needsBrd: true,
    needsTranscripts: false,
    needsPriorDocuments: [],
  },

  systemPrompt: SOW_SYSTEM_PROMPT,

  buildUserPrompt: ({ project, brd }) =>
    buildSowUserPrompt({
      projectName: project.name,
      projectContext: project.context,
      brdContent: brd?.content || "(no BRD available — cannot draft SOW)",
    }),

  cta: {
    generate: "Generate SOW",
    regenerate: "Regenerate SOW",
    generatingText:
      "Drafting the Statement of Work from the BRD. This usually takes 10–25 seconds.",
    enabledHelperText: "Ready to draft from the latest BRD.",
  },

  canRunFor: (state) =>
    state.hasBrd ? true : "Needs a BRD to be generated first.",
};
