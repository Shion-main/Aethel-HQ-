export type IntakeFieldType = "text" | "email" | "url" | "tel" | "textarea";

export interface IntakeField {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
}

export type FollowUpStatus =
  | "new"
  | "interested"
  | "following_up"
  | "closed"
  | "hired";

export type AgentKind = "conversational" | "generative";

// ---------- Conversational agent context types ----------

export interface ChatPromptContext {
  projectContext: string;
  intake: Record<string, string>;
  stakeholder: { id: string; name?: string | null; role?: string | null };
}

export interface SynthesisStakeholder {
  id: string;
  name: string;
  role: string | null;
  intake: Record<string, string>;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface SynthesisContext {
  projectId: string;
  project: { name: string; context: string | null };
  stakeholders: SynthesisStakeholder[];
}

// ---------- Generative agent context types ----------

export interface ProjectGenerativeState {
  hasBrd: boolean;
  documentsByKind: Record<string, number>;
  completedStakeholderCount: number;
}

export interface GenerativeTranscript {
  stakeholderName: string;
  stakeholderRole: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface GenerativeContext {
  project: { id: string; name: string; context: string | null };
  brd: { content: string } | null;
  priorDocuments: Record<string, Array<{ content: string; created_at: string }>>;
  transcripts: GenerativeTranscript[];
}

// ---------- Agent shapes ----------

interface BaseAgent {
  id: string;
  name: string;
  shortDescription: string;
  model: string;
}

export interface ConversationalAgent extends BaseAgent {
  kind: "conversational";

  intakeSchema: IntakeField[];

  buildInterviewerSystemPrompt: (ctx: ChatPromptContext) => string;
  synthesizerSystemPrompt: string;
  buildSynthesizerUserPrompt: (ctx: SynthesisContext) => string;

  synthesis: {
    kind: "brd";
    documentKind: string;
    requireCompletedStakeholders: boolean;
  };

  endConversation: {
    cta: string;
    confirmText: string;
    thankYou: string;
  };
}

export interface GenerativeAgent extends BaseAgent {
  kind: "generative";

  document: {
    kind: string;       // e.g. 'sow', 'tech_spec' — matches documents.kind
    label: string;      // short label: "SOW"
    title: string;      // full label: "Statement of Work"
  };

  inputs: {
    needsBrd: boolean;
    needsTranscripts: boolean;
    needsPriorDocuments: string[];
  };

  systemPrompt: string;
  buildUserPrompt: (ctx: GenerativeContext) => string;

  cta: {
    generate: string;
    regenerate: string;
    generatingText: string;
    enabledHelperText: string;
  };

  /** Returns true if runnable; returns a string reason if disabled. */
  canRunFor: (state: ProjectGenerativeState) => true | string;
}

export type AgentConfig = ConversationalAgent | GenerativeAgent;

// Convenience guards
export const isConversational = (a: AgentConfig): a is ConversationalAgent =>
  a.kind === "conversational";
export const isGenerative = (a: AgentConfig): a is GenerativeAgent =>
  a.kind === "generative";
