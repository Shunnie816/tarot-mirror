import type { Element, Suit } from "@tarot-mirror/decks";

import type { Insight } from "../types";
import {
  cardsOf,
  clamp01,
  deckElements,
  deckHasBothArcana,
  elementsPresent,
  reversalRatio,
  type SpreadRule,
} from "./context";

/**
 * Rules about what the spread is *made of* — suit, arcana, orientation,
 * element, number. Each one asks a single question and emits at most one
 * observation, so each gets exactly one test.
 */

export const suitDominance: SpreadRule = {
  id: "suitDominance",
  scope: "any",
  weight: 0.8,
  evaluate(ctx) {
    const suited = cardsOf(ctx).filter((c) => c.suit !== undefined);
    // Below three suited cards there is no distribution worth naming.
    if (suited.length < 3) return [];

    const counts = new Map<Suit, number>();
    for (const card of suited) {
      counts.set(card.suit!, (counts.get(card.suit!) ?? 0) + 1);
    }

    for (const [suit, count] of counts) {
      const ratio = count / suited.length;
      if (ratio >= 0.5) {
        return [
          {
            id: `insight.suitDominance.${suit}`,
            subjects: ctx.positions
              .filter((p) => ctx.cards.get(p.positionId)?.suit === suit)
              .map((p) => p.positionId),
            strength: clamp01((ratio - 0.5) / 0.5),
          },
        ];
      }
    }
    return [];
  },
};

export const majorRatio: SpreadRule = {
  id: "majorRatio",
  scope: "any",
  weight: 0.7,
  evaluate(ctx) {
    // In a majors-only deck every draw is 100% major arcana, which tells the
    // user nothing. Only claim a pattern the deck could have contradicted.
    if (!deckHasBothArcana(ctx.deck)) return [];

    const cards = cardsOf(ctx);
    if (cards.length < 3) return [];

    const majors = cards.filter((c) => c.arcana === "major");
    const ratio = majors.length / cards.length;
    const subjects = ctx.positions.map((p) => p.positionId);

    if (majors.length === 0) {
      return [{ id: "insight.majorRatio.none", subjects, strength: 1 }];
    }
    if (ratio >= 0.5) {
      return [
        {
          id: "insight.majorRatio.high",
          subjects: ctx.positions
            .filter((p) => ctx.cards.get(p.positionId)?.arcana === "major")
            .map((p) => p.positionId),
          strength: clamp01((ratio - 0.5) / 0.5),
        },
      ];
    }
    return [];
  },
};

export const reversalRatioRule: SpreadRule = {
  id: "reversalRatio",
  scope: "any",
  weight: 0.75,
  evaluate(ctx) {
    if (ctx.positions.length < 3) return [];

    const ratio = reversalRatio(ctx);
    if (ratio < 0.6) return [];

    return [
      {
        id: "insight.reversalRatio.high",
        subjects: ctx.positions
          .filter((p) => p.orientation === "reversed")
          .map((p) => p.positionId),
        strength: clamp01((ratio - 0.6) / 0.4),
      },
    ];
  },
};

export const elementMissing: SpreadRule = {
  id: "elementMissing",
  scope: "any",
  weight: 0.5,
  evaluate(ctx) {
    // With one or two cards, most elements are absent by arithmetic rather
    // than by meaning.
    if (ctx.positions.length < 3) return [];

    const present = elementsPresent(ctx);
    const possible = deckElements(ctx.deck);
    const missing = [...possible].filter((el) => !present.has(el));

    // If more than one element is absent, absence isn't distinctive.
    if (missing.length !== 1) return [];

    const element = missing[0] as Element;
    return [
      {
        id: `insight.elementMissing.${element}`,
        subjects: ctx.positions.map((p) => p.positionId),
        strength: 0.6,
      },
    ];
  },
};

export const numericEcho: SpreadRule = {
  id: "numericEcho",
  scope: "any",
  weight: 0.6,
  evaluate(ctx) {
    // Ranks only exist on minor arcana. Major arcana numbers are identifiers,
    // not stages, so "two cards numbered 3" would be a meaningless claim.
    const ranked = ctx.positions
      .map((p) => ({ positionId: p.positionId, rank: ctx.cards.get(p.positionId)?.rank }))
      .filter((entry): entry is { positionId: typeof entry.positionId; rank: number } =>
        entry.rank !== undefined,
      );
    if (ranked.length < 2) return [];

    const byRank = new Map<number, string[]>();
    for (const entry of ranked) {
      byRank.set(entry.rank, [...(byRank.get(entry.rank) ?? []), entry.positionId]);
    }

    const echoed = [...byRank.values()].filter((ids) => ids.length >= 2).flat();
    if (echoed.length === 0) return [];

    return [
      {
        id: "insight.numericEcho",
        subjects: echoed,
        strength: clamp01(echoed.length / ranked.length),
      },
    ];
  },
};

export const aceOrTen: SpreadRule = {
  id: "aceOrTen",
  scope: "any",
  weight: 0.55,
  evaluate(ctx) {
    const marked = ctx.positions.filter((p) => {
      const rank = ctx.cards.get(p.positionId)?.rank;
      return rank === 1 || rank === 10;
    });
    if (marked.length === 0) return [];

    return [
      {
        id: "insight.aceOrTen",
        subjects: marked.map((p) => p.positionId),
        strength: clamp01(marked.length / ctx.positions.length),
      },
    ];
  },
};

export const courtPresence: SpreadRule = {
  id: "courtPresence",
  scope: "any",
  weight: 0.5,
  evaluate(ctx) {
    const courts = ctx.positions.filter(
      (p) => ctx.cards.get(p.positionId)?.court !== undefined,
    );
    if (courts.length === 0) return [];

    return [
      {
        id: "insight.courtPresence",
        subjects: courts.map((p) => p.positionId),
        strength: clamp01(courts.length / ctx.positions.length),
      },
    ];
  },
};

export const COMPOSITION_RULES: readonly SpreadRule[] = [
  suitDominance,
  majorRatio,
  reversalRatioRule,
  elementMissing,
  numericEcho,
  aceOrTen,
  courtPresence,
];
