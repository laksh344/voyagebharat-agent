import { streamText, convertToModelMessages, stepCountIs, type UIMessage, type LanguageModel } from 'ai';
import type { GatewayProviderOptions } from '@ai-sdk/gateway';
import { tools } from './tools';
import { systemPrompt } from './prompt';

/** Vercel AI Gateway: a plain "provider/model" string is all it takes — no provider SDK, no per-provider key.
 *  Defaults are models confirmed working on the free tier with tool calling (gateway log, 29 Sep 2026). */
export const MODEL = process.env.AGENT_MODEL ?? 'openai/gpt-oss-120b';
export const FALLBACKS = (process.env.AGENT_FALLBACKS ?? 'spacexai/grok-4.1-fast-non-reasoning,openai/gpt-4o-mini').split(',').map((s) => s.trim()).filter(Boolean);
export const MAX_STEPS = 12;

/** The agent loop: reason → call tools (in parallel) → observe results → repeat, up to MAX_STEPS. */
export async function runAgent(messages: UIMessage[], model: LanguageModel = MODEL) {
  return streamText({
    model,
    system: systemPrompt(),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    // Always end with a written answer: once the budget is calculated, or on the last allowed step,
    // tools are switched off so the model must reply instead of running out of steps mid-research.
    prepareStep: ({ steps, stepNumber }) => {
      const budgeted = steps.some((s) => s.toolCalls.some((c) => c.toolName === 'estimateBudget'));
      return budgeted || stepNumber >= MAX_STEPS - 1 ? { toolChoice: 'none' } : undefined;
    },
    providerOptions: {
      gateway: {
        models: FALLBACKS,                       // automatic cross-provider failover
        tags: ['voyagebharat', 'travel-agent'],  // per-feature spend & latency reporting in the AI Gateway dashboard
      } satisfies GatewayProviderOptions,
    },
  });
}
