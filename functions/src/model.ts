import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import {
  FORMAT_OUTPUT_SCHEMA,
  type FormatPrompt,
  type LlmFormatOutput,
} from "@tarot-mirror/engine";
import * as z from "zod";

/**
 * The one place that talks to Anthropic.
 *
 * Everything above it takes a `ModelClient`, which is why the retry rule, the
 * tone check and the fallback can all be tested without a key, a network or a
 * bill. The handler never sees an SDK type.
 */

export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ModelAnswer {
  readonly output: LlmFormatOutput;
  readonly usage: ModelUsage;
}

export interface ModelClient {
  complete(prompt: FormatPrompt): Promise<ModelAnswer>;
}

/**
 * The default model.
 *
 * The intelligence lives in the Rule Engine; this is a bounded, low-difficulty
 * formatting job, so the cheapest capable model is the right one. Note that a
 * ~900 token system prompt sits well under Haiku's 4,096 token minimum cache
 * prefix — prompt caching does not apply here and no cost estimate should
 * assume it does.
 */
export const DEFAULT_MODEL = "claude-haiku-4-5";

/** Enough for three positions, a synthesis and a question, with room to spare. */
export const MAX_OUTPUT_TOKENS = 2048;

const outputSchema = z.object({
  positions: z
    .array(z.object({ positionId: z.string(), text: z.string() }))
    .min(1),
  synthesis: z.string(),
  closingQuestion: z.string(),
});

export class UnusableAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnusableAnswerError";
  }
}

export function createAnthropicClient(
  apiKey: string,
  model: string = DEFAULT_MODEL,
): ModelClient {
  const client = new Anthropic({ apiKey });

  return {
    complete: async (prompt: FormatPrompt): Promise<ModelAnswer> => {
      const message = await client.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
        output_config: {
          format: jsonSchemaOutputFormat(FORMAT_OUTPUT_SCHEMA),
        },
      });

      const parsed = outputSchema.safeParse(message.parsed_output);
      if (!parsed.success) {
        throw new UnusableAnswerError("model returned an unusable shape");
      }

      return {
        output: parsed.data,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    },
  };
}
