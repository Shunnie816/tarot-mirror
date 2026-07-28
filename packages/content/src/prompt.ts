import ja from "./ja/prompt.json" with { type: "json" };

import { MissingCopyError } from "./dictionary";
import type { Locale, PromptId } from "./ids";

/**
 * The LLM's instructions — copy that only a server ever reads.
 *
 * Deliberately outside the main `Dictionary`. Everything in there ends up in
 * the browser bundle, and this text is used in exactly one place: the Cloud
 * Function that builds a prompt. Shipping it to every reader would put a few
 * kilobytes of instructions for a model into the download of a person who may
 * never use one — the same reason the Firebase SDK is not in the initial
 * bundle.
 *
 * It is still copy, so it still lives in `packages/content` and still follows
 * the tone rules (`tone.test.ts` scans it). It just has its own door.
 */

const PROMPTS: Readonly<Record<Locale, Readonly<Record<PromptId, string>>>> = {
  ja,
};

export type PromptResolver = (id: PromptId) => string;

export function getPromptCopy(locale: Locale): PromptResolver {
  const table = PROMPTS[locale];

  return (id) => {
    const value = table[id];
    if (value === undefined) throw new MissingCopyError("prompt", id);
    return value;
  };
}

/** For completeness tests. */
export const promptTables = PROMPTS;
