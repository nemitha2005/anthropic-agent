export const DEFAULT_CHAT_MODEL = "claude-sonnet-4-20250514";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Fast and affordable, great for everyday tasks",
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Best balance of speed, intelligence, and cost",
  },
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Most capable Anthropic model",
  },
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude Sonnet 3.7",
    provider: "reasoning",
    description: "Extended thinking for complex problems",
  },
];

// Group models by provider for UI
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
