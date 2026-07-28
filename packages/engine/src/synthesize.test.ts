import { getResolver } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import type { RankedInsight } from "./rules/index";
import { ONE_CARD, RELATIONSHIP_8, THREE_CARDS } from "./spreads";
import {
  createReading,
  MAX_INSIGHTS,
  MAX_REFLECTION_QUESTIONS,
  rankInsights,
  selectReflectionQuestions,
} from "./synthesize";
import { contextFor, testCard, testDeck } from "./testing";

const insight = (
  id: string,
  ruleId: string,
  score: number,
): RankedInsight => ({
  id: id as RankedInsight["id"],
  ruleId,
  score,
  strength: score,
  subjects: [],
});

describe("rankInsights", () => {
  it("should order insights by score, strongest first", () => {
    const ranked = rankInsights([
      insight("insight.aceOrTen", "aceOrTen", 0.2),
      insight("insight.courtPresence", "courtPresence", 0.9),
      insight("insight.numericEcho", "numericEcho", 0.5),
    ]);

    expect(ranked.map((i) => i.id)).toEqual([
      "insight.courtPresence",
      "insight.numericEcho",
      "insight.aceOrTen",
    ]);
  });

  it("should cap the number of insights so the reading stays legible", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      insight(`insight.fake${i}`, `rule${i}`, i / 10),
    );

    expect(rankInsights(many)).toHaveLength(MAX_INSIGHTS);
  });

  it("should drop an element-absence observation when a suit already dominates", () => {
    // Both describe the same fact; reporting each separately reads as padding.
    const ranked = rankInsights([
      insight("insight.suitDominance.cups", "suitDominance", 0.8),
      insight("insight.elementMissing.fire", "elementMissing", 0.6),
    ]);

    expect(ranked.map((i) => i.id)).toEqual(["insight.suitDominance.cups"]);
  });

  it("should keep the element-absence observation when no suit dominates", () => {
    const ranked = rankInsights([
      insight("insight.elementMissing.fire", "elementMissing", 0.6),
    ]);

    expect(ranked.map((i) => i.id)).toEqual(["insight.elementMissing.fire"]);
  });

  it("should keep only the first of two identical insight ids", () => {
    const ranked = rankInsights([
      insight("insight.aceOrTen", "aceOrTen", 0.9),
      insight("insight.aceOrTen", "aceOrTen", 0.4),
    ]);

    expect(ranked).toHaveLength(1);
  });
});

describe("selectReflectionQuestions", () => {
  const DECK = testDeck([
    { ...testCard({ id: "t.a" }), reflectionSeeds: ["q.whatAreYouHolding", "q.whoDecides"] },
    { ...testCard({ id: "t.b" }), reflectionSeeds: ["q.whatChangedRecently", "q.whoDecides"] },
    { ...testCard({ id: "t.c" }), reflectionSeeds: ["q.whatIsWorkingAlready", "q.whatAreYouWaitingFor"] },
  ] as never);

  const ctx = contextFor(THREE_CARDS, DECK, [["t.a"], ["t.b"], ["t.c"]]);

  it("should lead with questions from cards the insights actually point at", () => {
    const questions = selectReflectionQuestions(
      ctx.positions,
      [{ id: "insight.aceOrTen", subjects: ["pos.future"], strength: 1 }],
      ctx.cards,
    );

    expect(questions[0]).toBe("q.whatIsWorkingAlready");
  });

  it("should not repeat a question shared by two cards", () => {
    const questions = selectReflectionQuestions(ctx.positions, [], ctx.cards);

    expect(new Set(questions).size).toBe(questions.length);
  });

  it("should return at most the configured number of questions", () => {
    const questions = selectReflectionQuestions(ctx.positions, [], ctx.cards);

    expect(questions.length).toBeLessThanOrEqual(MAX_REFLECTION_QUESTIONS);
  });

  it("should fall back to the drawn cards when no insight fired", () => {
    const questions = selectReflectionQuestions(ctx.positions, [], ctx.cards);

    expect(questions.length).toBeGreaterThan(0);
  });
});

describe("createReading", () => {
  const base = {
    spread: THREE_CARDS,
    deck: riderWaite,
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  } as const;

  it("should produce an identical reading for the same seed", () => {
    expect(createReading({ ...base, seed: "s" })).toEqual(
      createReading({ ...base, seed: "s" }),
    );
  });

  it("should produce a different reading for a different seed", () => {
    expect(createReading({ ...base, seed: "a" })).not.toEqual(
      createReading({ ...base, seed: "b" }),
    );
  });

  it("should carry the user's question through untouched", () => {
    const reading = createReading({ ...base, seed: "s", question: "転職すべきか" });

    expect(reading.question).toBe("転職すべきか");
  });

  it("should omit the question field entirely when none was asked", () => {
    const reading = createReading({ ...base, seed: "s" });

    expect("question" in reading).toBe(false);
  });

  it("should record the seed so the draw can be replayed", () => {
    expect(createReading({ ...base, seed: "replay-me" }).seed).toBe("replay-me");
  });

  it("should return one position reading per spread slot", () => {
    const reading = createReading({ ...base, spread: RELATIONSHIP_8, seed: "s" });

    expect(reading.positions).toHaveLength(RELATIONSHIP_8.positions.length);
  });

  it("should never exceed the insight cap", () => {
    for (let i = 0; i < 100; i++) {
      const reading = createReading({ ...base, spread: RELATIONSHIP_8, seed: `s${i}` });

      expect(reading.insights.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    }
  });

  it("should always offer at least one reflection question", () => {
    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      for (let i = 0; i < 30; i++) {
        const reading = createReading({ ...base, spread, seed: `q${i}` });

        expect(reading.reflection.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * The engine emits IDs and the dictionary resolves them, so an ID with no copy
 * is invisible until render time. Sweeping many seeds across every spread
 * exercises far more rule combinations than hand-written cases would.
 */
describe("engine ↔ content integrity", () => {
  const resolver = getResolver("ja");

  it("should emit only insight ids that have Japanese copy", () => {
    const unresolved = new Set<string>();

    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      for (let i = 0; i < 300; i++) {
        const reading = createReading({ spread, deck: riderWaite, seed: `sweep-${i}` });
        for (const item of reading.insights) {
          if (!resolver.has("insights", item.id)) unresolved.add(item.id);
        }
      }
    }

    expect([...unresolved]).toEqual([]);
  });

  it("should emit only framing ids that have Japanese copy", () => {
    const unresolved = new Set<string>();

    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      for (let i = 0; i < 100; i++) {
        const reading = createReading({ spread, deck: riderWaite, seed: `f-${i}` });
        for (const position of reading.positions) {
          if (!resolver.has("framings", position.framing)) {
            unresolved.add(position.framing);
          }
        }
      }
    }

    expect([...unresolved]).toEqual([]);
  });

  it("should emit only position ids that have Japanese copy", () => {
    const unresolved = new Set<string>();

    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      const reading = createReading({ spread, deck: riderWaite, seed: "p" });
      for (const position of reading.positions) {
        if (!resolver.has("positions", position.positionId)) {
          unresolved.add(position.positionId);
        }
      }
    }

    expect([...unresolved]).toEqual([]);
  });
});
