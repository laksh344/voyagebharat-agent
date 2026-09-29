import { streamText, convertToModelMessages, stepCountIs, type UIMessage, type LanguageModel } from 'ai';
import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { tools } from './tools';
import { systemPrompt } from './prompt';

/** Vercel AI Gateway: a plain "provider/model" string is all it takes — no provider SDK, no per-provider key. */
export const MODEL = process.env.AGENT_MODEL ?? 'google/gemini-3.6-flash';
export const FALLBACKS = (process.env.AGENT_FALLBACKS ?? 'deepseek/deepseek-v4-flash,openai/gpt-5-nano').split(',').map((s) => s.trim()).filter(Boolean);
export const MAX_STEPS = 10;

/** The agent loop: reason → call tools (in parallel) → observe results → repeat, up to MAX_STEPS. */
export async function runAgent(messages: UIMessage[], model: LanguageModel = MODEL) {
  return streamText({
    model,
    system: systemPrompt(),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      gateway: {
        models: FALLBACKS,                       // automatic cross-provider failover
        tags: ['voyagebharat', 'travel-agent'],  // per-feature spend & latency reporting in the AI Gateway dashboard
      } satisfies GatewayProviderOptions,
    },
  });
}
