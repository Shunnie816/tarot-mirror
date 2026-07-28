import type { QuestionId } from "@tarot-mirror/content";
import type { Card, Deck } from "@tarot-mirror/decks";

import { drawCards, type DrawOptions } from "./draw";
import { interpretDraw } from "./interpret";
import { buildContext, evaluateRules, type RankedInsight } from "./rules/index";
import type { Insight, PositionReading, ReadingJSON, Spread } from "./types";

/**
 * Cap on observations shown per reading.
 *
 * This is a design decision as much as a cost one. The app's whole premise is
 * getting the user to slow down and think about one or two things; handing
 * them nine observations produces skimming, not reflection. It also keeps the
 * ReadingJSON handed to the LLM at a predictable size.
 */
export const MAX_INSIGHTS = 4;
export const MAX_REFLECTION_QUESTIONS = 3;

/**
 * Rules whose output makes another rule's output redundant.
 *
 * `[winner, suppressed]` — if the winner fired, the suppressed rule's insights
 * are dropped. Without this, a Cups-heavy spread reports "emotion dominates"
 * and "the fire element is absent", which are two descriptions of one fact.
 */
const SUPPRESSION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["suitDominance", "elementMissing"],
  ["majorRatio", "numericEcho"],
];

export function rankInsights(insights: readonly RankedInsight[]): RankedInsight[] {
  const firedRules = new Set(insights.map((i) => i.ruleId));
  const suppressed = new Set(
    SUPPRESSION_PAIRS.filter(([winner]) => firedRules.has(winner)).map(
      ([, loser]) => loser,
    ),
  );

  const seen = new Set<string>();
  return insights
    .filter((insight) => !suppressed.has(insight.ruleId))
    .filter((insight) => {
      // A rule could in principle emit the same insight id twice; keep the first.
      if (seen.has(insight.id)) return false;
      seen.add(insight.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSIGHTS);
}

/**
 * Choose the questions to close the reading with.
 *
 * Questions attached to cards the top insights actually point at come first,
 * so the closing prompts follow the thread of the reading rather than being a
 * generic list. Remaining slots fall back to the other drawn cards.
 */
export function selectReflectionQuestions(
  positions: readonly PositionReading[],
  insights: readonly Insight[],
  cards: ReadonlyMap<string, Card>,
): QuestionId[] {
  const subjectPositions = insights.flatMap((insight) => insight.subjects);
  const prioritised = [
    ...subjectPositions,
    ...positions.map((p) => p.positionId),
  ];

  const chosen: QuestionId[] = [];
  const seen = new Set<string>();

  for (const positionId of prioritised) {
    const card = cards.get(positionId);
    if (!card) continue;

    for (const question of card.reflectionSeeds as QuestionId[]) {
      if (seen.has(question)) continue;
      seen.add(question);
      chosen.push(question);
      if (chosen.length >= MAX_REFLECTION_QUESTIONS) return chosen;
    }
  }

  return chosen;
}

export interface CreateReadingOptions extends Omit<DrawOptions, "spread" | "deck"> {
  readonly spread: Spread;
  readonly deck: Deck;
  /** The user's own words. Passed through untouched; never parsed by the engine. */
  readonly question?: string;
  /** Injectable for deterministic tests. */
  readonly now?: () => Date;
}

/**
 * The complete L0 → L3 pipeline.
 *
 * Pure and deterministic given a seed: the same options always produce the
 * same ReadingJSON, which is what makes readings replayable and lets a failed
 * LLM call be retried without re-drawing.
 */
export function createReading(options: CreateReadingOptions): ReadingJSON {
  const { spread, deck, seed, question, now = () => new Date() } = options;

  const drawn = drawCards({
    spread,
    deck,
    seed,
    ...(options.allowReversals !== undefined
      ? { allowReversals: options.allowReversals }
      : {}),
    ...(options.reversalRate !== undefined
      ? { reversalRate: options.reversalRate }
      : {}),
  });

  const deckIndex = new Map(deck.cards.map((card) => [card.id, card]));
  const positions = interpretDraw(spread, drawn, (id) => {
    const card = deckIndex.get(id);
    if (!card) throw new Error(`Card "${id}" is not in deck "${deck.id}"`);
    return card;
  });
  const context = buildContext(spread, positions, deck);
  const ranked = rankInsights(evaluateRules(context));

  const insights: Insight[] = ranked.map(({ id, subjects, strength }) => ({
    id,
    subjects,
    strength,
  }));

  return {
    version: 1,
    seed,
    spreadId: spread.id,
    ...(question !== undefined ? { question } : {}),
    positions,
    insights,
    reflection: selectReflectionQuestions(positions, insights, context.cards),
    meta: {
      deckIds: [deck.id],
      drawnAt: now().toISOString(),
    },
  };
}
