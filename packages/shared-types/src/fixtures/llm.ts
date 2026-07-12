import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
} from '../llm.js';

export const sampleLlmChatMessages: LlmChatMessage[] = [
  { role: 'system', content: 'You are a senior software architect.' },
  {
    role: 'user',
    content: 'Explain why camelCase naming is preferred in this TypeScript codebase.',
  },
];

export const sampleLlmCompletionResponse: LlmCompletionResponse = {
  content:
    'Prefer camelCase for modules and functions to match existing TypeScript conventions in services and routes.',
  provider: 'local',
  model: 'local-mock',
  usage: {
    promptTokens: 42,
    completionTokens: 28,
    totalTokens: 70,
  },
  cached: false,
};

export const sampleLlmEmbeddingResponse: LlmEmbeddingResponse = {
  embedding: [0.12, -0.34, 0.56, 0.01],
  provider: 'local',
  model: 'local-embed',
  usage: {
    promptTokens: 8,
    completionTokens: 0,
    totalTokens: 8,
  },
  cached: false,
};

export const sampleDivergenceReasoningPrompt =
  'Given a snake_case ticket approach and a camelCase codebase, recommend which naming convention to follow and why.';
