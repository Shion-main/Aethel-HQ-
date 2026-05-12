import type { AgentConfig } from "./types";
import { businessAnalystConfig } from "@/agents/business-analyst/config";

const REGISTRY: Record<string, AgentConfig> = {
  [businessAnalystConfig.id]: businessAnalystConfig,
};

export const getAgent = (id: string): AgentConfig | null => REGISTRY[id] ?? null;

export const requireAgent = (id: string): AgentConfig => {
  const agent = getAgent(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
};

export const listAgents = (): AgentConfig[] => Object.values(REGISTRY);
