import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { AgentConfig } from "./types";

export type FollowUpTone =
  | "initial_response"
  | "schedule_meeting"
  | "status_update"
  | "decline"
  | "custom";

const TONE_GUIDANCE: Record<FollowUpTone, string> = {
  initial_response:
    "Warm, appreciative, and concrete. Thank them for their time, acknowledge 2-3 specific things they shared, and indicate that you'll be reviewing the conversation more carefully.",
  schedule_meeting:
    "Propose a follow-up meeting. Suggest one or two concrete time windows, and explain what the meeting would cover based on what came up in the conversation.",
  status_update:
    "Update them on where things stand: what's been done since their conversation, what's next, and any timing they should expect. Honest and specific, not corporate-vague.",
  decline:
    "Politely decline moving forward. Be respectful, give a clear (but kind) reason, and thank them for their input. Avoid generic language; reference one thing they shared so it doesn't feel templated.",
  custom:
    "Follow the admin's free-text notes precisely. The tone and content should be shaped entirely by those notes; don't invent direction not specified there.",
};

export interface FollowUpInput {
  agent: AgentConfig;
  tone: FollowUpTone;
  adminNotes: string;
  stakeholder: {
    name: string;
    role: string | null;
    email: string | null;
    company: string | null;
  };
  projectName: string;
  projectContext: string | null;
  latestBrdContent: string | null;
}

export interface FollowUpDraft {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You are an executive assistant drafting a follow-up email on behalf of the team at Aethel Labs.

You write in clear, warm, professional English. You never use buzzwords or corporate jargon. You write the way a thoughtful senior colleague would write — direct, considerate, specific.

Output JSON ONLY, matching this exact shape:
{"subject": "...", "body": "..."}

Rules for the output:
- "subject": concise subject line, under 80 characters, no spam-trigger words
- "body": full email body as plain text. Use \\n\\n between paragraphs. No Markdown, no bullet lists unless absolutely necessary. Sign off with "— The Aethel Labs team".
- Do NOT wrap the JSON in code fences. Do NOT add any text before or after the JSON object.`;

const extractJson = (text: string): FollowUpDraft | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
      return { subject: parsed.subject, body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
};

export async function draftFollowUpEmail(input: FollowUpInput): Promise<FollowUpDraft> {
  const {
    agent,
    tone,
    adminNotes,
    stakeholder,
    projectName,
    projectContext,
    latestBrdContent,
  } = input;

  const brdSummary = latestBrdContent
    ? latestBrdContent.slice(0, 4000)
    : "(no BRD generated yet — base the email only on stakeholder context and admin notes)";

  const userPrompt = `# Tone for this email
${TONE_GUIDANCE[tone]}

# Admin notes (free text from the Aethel Labs team about what this email should say)
${adminNotes.trim() || "(none)"}

# Stakeholder
Name: ${stakeholder.name}
Role: ${stakeholder.role || "(unspecified)"}
Company: ${stakeholder.company || "(unspecified)"}
Email: ${stakeholder.email || "(unspecified)"}

# Project
Name: ${projectName}
Context: ${projectContext || "(none provided)"}

# Latest BRD excerpt (for reference — don't quote it directly)
${brdSummary}

Draft the email now. Output ONLY the JSON object.`;

  const { text } = await generateText({
    model: google(agent.model),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.6,
  });

  const parsed = extractJson(text);
  if (parsed) return parsed;

  // Fallback: derive subject from first non-empty line, body = rest
  const lines = text.split("\n").filter((l) => l.trim());
  return {
    subject: (lines[0] || "Follow-up").slice(0, 80),
    body: lines.slice(1).join("\n") || text,
  };
}
