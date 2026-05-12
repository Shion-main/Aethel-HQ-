import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { stripCompletionToken } from "@/lib/agents/business-analyst/types";
import { parseSuggestions } from "@/lib/agents/business-analyst/parse-suggestions";

export interface ExtractedProjectMeta {
  name: string;
  context: string;
}

interface ExtractorInput {
  model: string;
  stakeholder: {
    name: string;
    role: string | null;
    company: string | null;
  };
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const SYSTEM = `You read a stakeholder interview transcript and extract two pieces of metadata for a project record.

Return JSON ONLY in this exact shape:
{"name": "...", "context": "..."}

Rules:
- "name": a short, specific project title — 3 to 7 words. Use the stakeholder's domain language. No generic phrases like "Stakeholder Project" or "Untitled". Do not include quotes, dates, or the stakeholder's personal name. If the stakeholder mentioned the project's actual name, use it.
- "context": 2-3 sentences describing what the project is about, who it's for, and what kind of help is being sought. Plain language, no buzzwords, no jargon. Write as if briefing a developer who is about to read the BRD.
- Do not wrap the JSON in code fences. Do not add anything before or after the JSON object.
- If the transcript is too thin to support a confident name, use the most concrete noun phrase the stakeholder used (e.g., "Pickleball booking system").`;

const extractJson = (text: string): ExtractedProjectMeta | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (
      typeof parsed.name === "string" &&
      typeof parsed.context === "string" &&
      parsed.name.trim() &&
      parsed.context.trim()
    ) {
      return { name: parsed.name.trim(), context: parsed.context.trim() };
    }
    return null;
  } catch {
    return null;
  }
};

export async function extractProjectMetadata(
  input: ExtractorInput
): Promise<ExtractedProjectMeta | null> {
  const turns = input.messages
    .slice(0, 20) // first 20 turns are usually enough for naming/context
    .map((m) => {
      const speaker = m.role === "user" ? input.stakeholder.name : "Interviewer";
      const stripped = stripCompletionToken(m.content);
      const clean =
        m.role === "assistant"
          ? parseSuggestions(stripped).cleanText || stripped
          : stripped;
      return `${speaker}: ${clean}`;
    })
    .join("\n\n");

  const userPrompt = `# Stakeholder
Name: ${input.stakeholder.name}
Role: ${input.stakeholder.role || "(unspecified)"}
Company: ${input.stakeholder.company || "(unspecified)"}

# Transcript (first 20 turns)
${turns}

Output the JSON now.`;

  try {
    const { text } = await generateText({
      model: groq(input.model),
      system: SYSTEM,
      prompt: userPrompt,
      temperature: 0.2,
    });
    return extractJson(text);
  } catch (err) {
    console.error("[project-extractor] Groq error", err);
    return null;
  }
}
