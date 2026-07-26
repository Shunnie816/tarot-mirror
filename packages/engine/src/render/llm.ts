import {
  DEFAULT_LOCALE,
  findToneViolations,
  type Locale,
  type ToneViolation,
} from "@tarot-mirror/content";

import type { ReadingJSON } from "../types.js";
import { renderTemplate } from "./template.js";
import type { ReadingRenderer, RenderedReading } from "./types.js";

/**
 * L4b — the LLM renderer.
 *
 * It owns one decision: is this answer good enough to show instead of the
 * template? Everything about *getting* the answer (network, API keys, retries
 * against a provider) sits behind `FormatPort`, so the judgement can be tested
 * without a network and, more importantly, so the fallback path is exercised
 * by ordinary unit tests rather than only in production.
 *
 * The renderer never fails. Every route out of here returns a complete
 * reading, because a reading that cannot be read is the one outcome this
 * architecture exists to prevent.
 */

/** The model's half of the contract — prose for slots the engine already chose. */
export interface LlmPositionText {
  readonly positionId: string;
  readonly text: string;
}

export interface LlmFormatOutput {
  readonly positions: readonly LlmPositionText[];
  readonly synthesis: string;
  readonly closingQuestion: string;
}

/** How the renderer reaches a model. `null` means "no answer" — not an error. */
export interface FormatPort {
  format(
    reading: ReadingJSON,
    locale: Locale,
  ): Promise<LlmFormatOutput | null>;
}

export type RejectionReason = "missingPosition" | "emptyText" | "toneViolation";

export interface Rejection {
  readonly reason: RejectionReason;
  /** Position id, or the section name for the parts that have no id. */
  readonly at: string;
  readonly violations?: readonly ToneViolation[];
}

export type MergeResult =
  | { readonly ok: true; readonly reading: RenderedReading }
  | { readonly ok: false; readonly rejections: readonly Rejection[] };

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Fold the model's prose into the template's scaffolding.
 *
 * The structural fields — spread label, position labels, card names,
 * orientation, group — are taken from the template and never from the model.
 * This is the load-bearing part: it means a model that hallucinates a card
 * still cannot put a wrong card name on screen, because it was never asked
 * for one. All it can do is write text that fails validation below.
 *
 * Returns the rejections rather than just `null` so the caller can log *why*
 * a rendering was thrown away. A silent fallback that costs money every time
 * and never says what is wrong is how an LLM feature quietly stops working.
 */
export function mergeLlmOutput(
  base: RenderedReading,
  output: LlmFormatOutput,
): MergeResult {
  const rejections: Rejection[] = [];
  const byId = new Map(output.positions.map((p) => [p.positionId, p.text]));

  const check = (at: string, text: string): boolean => {
    if (isBlank(text)) {
      rejections.push({ reason: "emptyText", at });
      return false;
    }
    const violations = findToneViolations(text);
    if (violations.length > 0) {
      rejections.push({ reason: "toneViolation", at, violations });
      return false;
    }
    return true;
  };

  const positions = base.positions.map((position) => {
    const text = byId.get(position.positionId);
    if (text === undefined) {
      rejections.push({
        reason: "missingPosition",
        at: position.positionId,
      });
      return position;
    }
    return check(position.positionId, text) ? { ...position, text } : position;
  });

  check("synthesis", output.synthesis);
  check("closingQuestion", output.closingQuestion);

  // 一部だけ差し替えると、同じ画面に文体の違う本文が並ぶ。書き手が二人いる
  // 読み物になるくらいなら、テンプレートで揃っているほうがいい。
  if (rejections.length > 0) {
    return { ok: false, rejections };
  }

  return {
    ok: true,
    reading: {
      ...base,
      mode: "llm",
      positions,
      synthesis: [output.synthesis],
      closingQuestions: [output.closingQuestion],
    },
  };
}

export interface LlmRendererOptions {
  /** Called when an answer arrived but was not good enough to show. */
  readonly onRejected?: (rejections: readonly Rejection[]) => void;
  /** Called when the port itself failed — network, auth, quota, no config. */
  readonly onUnavailable?: (error: unknown) => void;
}

/**
 * Wrap a port into a renderer that always produces a reading.
 *
 * The template result is computed first and kept: it is free, synchronous, and
 * it is also the scaffolding the model's prose gets folded into. There is no
 * path through this function that returns nothing.
 */
export function createLlmRenderer(
  port: FormatPort,
  options: LlmRendererOptions = {},
): ReadingRenderer {
  return {
    render: async (reading: ReadingJSON, locale: Locale = DEFAULT_LOCALE) => {
      const template = renderTemplate(reading, locale);

      let output: LlmFormatOutput | null;
      try {
        output = await port.format(reading, locale);
      } catch (error) {
        options.onUnavailable?.(error);
        return template;
      }

      if (output === null) return template;

      const merged = mergeLlmOutput(template, output);
      if (!merged.ok) {
        options.onRejected?.(merged.rejections);
        return template;
      }

      return merged.reading;
    },
  };
}
