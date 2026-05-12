export type Project = {
  id: string;
  name: string;
  context: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
};

export type Stakeholder = {
  id: string;
  project_id: string;
  name: string;
  role: string | null;
  token: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  completed_at: string | null;
};

export type Message = {
  id: string;
  stakeholder_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type Document = {
  id: string;
  project_id: string;
  agent_id: string;
  kind: string;
  title: string | null;
  content: string;
  model: string;
  created_at: string;
};

/** @deprecated Use Document. Kept for one cycle to ease imports. */
export type Brd = Document;

export const COMPLETION_TOKEN = "[[INTERVIEW_COMPLETE]]";

export const stripCompletionToken = (s: string) =>
  s.replace(/\[\[INTERVIEW_COMPLETE\]\]/g, "").trim();
