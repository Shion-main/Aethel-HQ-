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

export interface AgentConfig {
  id: string;
  name: string;
  shortDescription: string;

  model: string;

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
