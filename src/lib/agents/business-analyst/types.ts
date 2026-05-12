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

export type Brd = {
  id: string;
  project_id: string;
  content: string;
  model: string;
  created_at: string;
};

export const COMPLETION_TOKEN = "[[INTERVIEW_COMPLETE]]";

export const stripCompletionToken = (s: string) =>
  s.replace(/\[\[INTERVIEW_COMPLETE\]\]/g, "").trim();
