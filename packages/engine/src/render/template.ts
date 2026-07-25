import {
  DEFAULT_LOCALE,
  getResolver,
  type CopyResolver,
  type Locale,
} from "@tarot-mirror/content";

import { getSpread } from "../spreads.js";
import type { PositionReading, ReadingJSON } from "../types.js";
import type { RenderedPosition, RenderedReading } from "./types.js";

/**
 * L4a — turn a ReadingJSON into Japanese prose using only the dictionary.
 *
 * This is the renderer that decides whether the whole architecture works. It
 * is synchronous, free, offline-capable, and cannot fail on a network. Because
 * a complete reading is always available from here, the LLM renderer is an
 * enhancement rather than a dependency — which is what makes the cost strategy
 * in PROJECT_OVERVIEW real rather than aspirational.
 */

export function renderKeywords(
  keywords: readonly string[],
  resolver: CopyResolver,
): string {
  const separator = resolver.ui("ui.keywordSeparator");
  return keywords
    .map((id) => resolver.keyword(id as `kw.${string}`))
    .join(separator);
}

export function renderPosition(
  position: PositionReading,
  resolver: CopyResolver,
): RenderedPosition {
  return {
    positionId: position.positionId,
    positionLabel: resolver.position(position.positionId),
    shortLabel: resolver.positionShort(position.positionId),
    cardName: resolver.card(position.cardId),
    orientationLabel: resolver.ui(`ui.${position.orientation}`),
    ...(position.group !== undefined ? { group: position.group } : {}),
    text: resolver.framing(position.framing, {
      keywords: renderKeywords(position.keywords, resolver),
    }),
  };
}

export function renderTemplate(
  reading: ReadingJSON,
  locale: Locale = DEFAULT_LOCALE,
): RenderedReading {
  const resolver = getResolver(locale);
  const spread = getSpread(reading.spreadId);

  const synthesis = reading.insights.map(
    (insight) => resolver.insight(insight.id).body,
  );

  return {
    mode: "template",
    locale,
    spreadLabel: resolver.spread(spread.labelId),
    ...(reading.question !== undefined ? { question: reading.question } : {}),
    positions: reading.positions.map((p) => renderPosition(p, resolver)),
    // When no rule fired, say so plainly rather than leaving a blank section.
    // A reading that renders nothing is worse than one that renders modestly.
    synthesis:
      synthesis.length > 0 ? synthesis : [resolver.ui("ui.noInsights")],
    closingQuestions: reading.reflection.map((id) => resolver.question(id)),
    closingNote: resolver.ui("ui.closingNote"),
  };
}

/** Synchronous renderer wrapped to satisfy the async `ReadingRenderer` interface. */
export const templateRenderer = {
  render: async (reading: ReadingJSON, locale: Locale = DEFAULT_LOCALE) =>
    renderTemplate(reading, locale),
};

/**
 * Flatten a rendered reading to plain text.
 *
 * Used by the tone validator, tests, and any surface that wants the whole
 * reading as one string (share, export, LLM prompt context).
 */
export function toPlainText(rendered: RenderedReading): string {
  const resolver = getResolver(rendered.locale);
  const lines: string[] = [rendered.spreadLabel, ""];

  if (rendered.question) {
    lines.push(`${resolver.ui("ui.questionHeading")}: ${rendered.question}`, "");
  }

  for (const position of rendered.positions) {
    lines.push(
      `【${position.positionLabel}】${position.cardName}（${position.orientationLabel}）`,
      position.text,
      "",
    );
  }

  lines.push(resolver.ui("ui.synthesisHeading"), ...rendered.synthesis, "");
  lines.push(
    resolver.ui("ui.reflectionHeading"),
    ...rendered.closingQuestions.map((q) => `・${q}`),
    "",
  );
  lines.push(rendered.closingNote);

  return lines.join("\n");
}
