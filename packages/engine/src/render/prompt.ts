import {
  BANNED_PHRASES,
  DEFAULT_LOCALE,
  getResolver,
  SANCTIONED_HEDGES,
  type CopyResolver,
  type Locale,
} from "@tarot-mirror/content";

import { getSpread } from "../spreads.js";
import type { PositionReading, ReadingJSON } from "../types.js";

/**
 * L4b — the instructions and the ingredients handed to the LLM.
 *
 * Nothing here writes Japanese. Every sentence in the prompt comes out of the
 * dictionary, and every ingredient comes out of the ReadingJSON, which means
 * the model receives exactly the meanings the Rule Engine decided on and no
 * others. That is what makes "invent nothing" checkable rather than hopeful.
 *
 * Deliberately *not* included: the template's rendered sentences. Handing the
 * model finished prose would turn it into a paraphraser — the exact failure
 * PROJECT_OVERVIEW warns about. It gets the position's lens and the keywords;
 * the sentence is its own work.
 */

/**
 * Bumped whenever the prompt or the output contract changes.
 *
 * The rendering cache keys on this, so raising it retires every cached
 * rendering rather than serving text produced under older instructions.
 */
export const PROMPT_VERSION = 1;

export interface FormatPrompt {
  readonly system: string;
  readonly user: string;
}

/**
 * The output contract, as a JSON Schema for structured outputs.
 *
 * Free text would have to be parsed back apart to fit the layout, and any
 * drift would land on screen. A schema means a malformed answer is a failure
 * we can see and fall back from, not a paragraph in the wrong place.
 */
export const FORMAT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    positions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          positionId: { type: "string" },
          text: { type: "string" },
        },
        required: ["positionId", "text"],
        additionalProperties: false,
      },
    },
    synthesis: { type: "string" },
    closingQuestion: { type: "string" },
  },
  required: ["positions", "synthesis", "closingQuestion"],
  additionalProperties: false,
} as const;

/** One numbered rule per line, so the prompt reads as a list rather than a wall. */
function numbered(lines: readonly string[]): string {
  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function bulleted(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

const LENSES = [
  "origin",
  "currentState",
  "trajectory",
  "advice",
  "catalyst",
  "theme",
] as const;

const ORIENTATIONS = ["upright", "reversed"] as const;

/**
 * The fixed half of the prompt: who the model is and what it may not do.
 *
 * Identical for every reading, so it is derived from the dictionary and the
 * tone rules alone — no ReadingJSON reaches it. The banned wordings are quoted
 * straight out of `BANNED_PHRASES`, which is the same list the validator runs
 * afterwards; telling the model one thing and checking another is how tone
 * rules rot.
 */
export function buildSystemPrompt(locale: Locale = DEFAULT_LOCALE): string {
  const resolver = getResolver(locale);

  const banned = BANNED_PHRASES.map(
    (phrase) => `${phrase.examples.join(" / ")} — ${phrase.reason}`,
  );

  return [
    resolver.prompt("prompt.role"),
    "",
    `## ${resolver.prompt("prompt.rulesHeading")}`,
    numbered([
      resolver.prompt("prompt.rule.materialsOnly"),
      `${resolver.prompt("prompt.rule.noAssertion")}\n${bulleted(SANCTIONED_HEDGES)}`,
      `${resolver.prompt("prompt.rule.banned")}\n${bulleted(banned)}`,
      resolver.prompt("prompt.rule.voice"),
      resolver.prompt("prompt.rule.noVerdict"),
      resolver.prompt("prompt.rule.noCardNames"),
      resolver.prompt("prompt.rule.noAdviceVoice"),
    ]),
    "",
    `## ${resolver.prompt("prompt.lensHeading")}`,
    bulleted(
      LENSES.map((lens) => `${lens}: ${resolver.prompt(`prompt.lens.${lens}`)}`),
    ),
    "",
    `## ${resolver.prompt("prompt.orientationHeading")}`,
    bulleted(
      ORIENTATIONS.map(
        (o) => `${o}: ${resolver.prompt(`prompt.orientation.${o}`)}`,
      ),
    ),
    "",
    `## ${resolver.prompt("prompt.lengthHeading")}`,
    resolver.prompt("prompt.length"),
  ].join("\n");
}

function describePosition(
  position: PositionReading,
  resolver: CopyResolver,
): string {
  const label = (id: `prompt.${string}`) => resolver.prompt(id);

  const lines = [
    `- ${label("prompt.label.positionId")}: ${position.positionId}`,
    `  ${label("prompt.label.positionLabel")}: ${resolver.position(position.positionId)}`,
    `  ${label("prompt.label.card")}: ${resolver.card(position.cardId)}（${position.orientation}）`,
    `  ${label("prompt.label.lens")}: ${position.lens}`,
  ];

  // 8枚引きでは「あなた」と「相手」で同じ読み筋が二度出てくる。どちら側かを
  // 渡さないと、モデルは同じ素材に同じ文章を書く。
  if (position.group !== undefined) {
    lines.push(
      `  ${label("prompt.label.side")}: ${resolver.group(`group.${position.group}`).label}`,
    );
  }

  lines.push(
    `  ${label("prompt.label.keywords")}: ${position.keywords
      .map((id) => resolver.keyword(id))
      .join(" / ")}`,
  );

  return lines.join("\n");
}

/**
 * The per-reading half: the meanings this draw produced.
 *
 * Insight bodies are passed as-is. Unlike a framing, an insight *is* the
 * observation — there is no keyword list underneath it to rebuild from — so
 * the model is rewriting a claim it was given rather than inventing one.
 */
export function buildUserPrompt(
  reading: ReadingJSON,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const resolver = getResolver(locale);
  const label = (id: `prompt.${string}`) => resolver.prompt(id);
  const spread = getSpread(reading.spreadId);

  const sections: string[] = [
    `${label("prompt.label.spread")}: ${resolver.spread(spread.labelId)}`,
  ];

  sections.push(
    reading.question !== undefined && reading.question.length > 0
      ? `${label("prompt.label.question")}: ${reading.question}`
      : label("prompt.label.noQuestion"),
  );

  sections.push(
    "",
    `## ${label("prompt.label.positions")}`,
    reading.positions.map((p) => describePosition(p, resolver)).join("\n"),
  );

  sections.push("", `## ${label("prompt.label.insights")}`);
  sections.push(
    reading.insights.length > 0
      ? bulleted(
          reading.insights.map((insight) => {
            const subjects = insight.subjects.join(", ");
            return `${resolver.insight(insight.id).body}（${label("prompt.label.subjects")}: ${subjects}）`;
          }),
        )
      : label("prompt.label.noInsights"),
  );

  sections.push(
    "",
    `## ${label("prompt.label.reflection")}`,
    bulleted(reading.reflection.map((id) => resolver.question(id))),
    "",
    label("prompt.label.task"),
  );

  return sections.join("\n");
}

export function buildFormatPrompt(
  reading: ReadingJSON,
  locale: Locale = DEFAULT_LOCALE,
): FormatPrompt {
  return {
    system: buildSystemPrompt(locale),
    user: buildUserPrompt(reading, locale),
  };
}
