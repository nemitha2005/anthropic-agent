export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // ── Latest Claude 4 generation (GA) ─────────────────────────────────────
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fastest model with near-frontier intelligence · $1 / $5 MTok",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Best balance of speed and intelligence · $3 / $15 MTok",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most intelligent — ideal for agents & coding · $5 / $25 MTok",
  },
  // ── Extended thinking ────────────────────────────────────────────────────
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude Sonnet 3.7",
    provider: "reasoning",
    description: "Classic extended-thinking model",
  },
];

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
