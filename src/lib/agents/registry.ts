import type { AgentConfig, AgentKind, ConversationalAgent } from "./types";
import { businessAnalystConfig } from "@/agents/business-analyst/config";
import { sowWriterConfig } from "@/agents/sow-writer/config";

const REGISTRY: Record<string, AgentConfig> = {
  [businessAnalystConfig.id]: businessAnalystConfig,
  [sowWriterConfig.id]: sowWriterConfig,
};

export const getAgent = (id: string): AgentConfig | null => REGISTRY[id] ?? null;

export const requireAgent = (id: string): AgentConfig => {
  const agent = getAgent(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
};

/**
 * Returns the conversational agent or null if the id is unknown or refers to
 * an agent of a different kind. Useful for routes/pages that only serve
 * stakeholder conversations.
 */
export const getConversationalAgent = (id: string): ConversationalAgent | null => {
  const agent = getAgent(id);
  if (!agent || agent.kind !== "conversational") return null;
  return agent;
};

export const listAgents = (kind?: AgentKind): AgentConfig[] => {
  const all = Object.values(REGISTRY);
  return kind ? all.filter((a) => a.kind === kind) : all;
};
