import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { ONE_CARD, RELATIONSHIP_8, THREE_CARDS } from "../spreads";
import { contextFor, testCard, testDeck } from "../testing";
import {
  aceOrTen,
  courtPresence,
  elementMissing,
  majorRatio,
  numericEcho,
  reversalRatioRule,
  suitDominance,
} from "./composition";

/**
 * One rule, one test. Each rule states a claim about a spread; these tests are
 * the specification of when that claim holds.
 */

const MIXED_DECK = testDeck([
  testCard({ id: "test.cups.01", suit: "cups", rank: 1, element: "water" }),
  testCard({ id: "test.cups.03", suit: "cups", rank: 3, element: "water" }),
  testCard({ id: "test.cups.10", suit: "cups", rank: 10, element: "water" }),
  testCard({ id: "test.wands.03", suit: "wands", rank: 3, element: "fire" }),
  testCard({ id: "test.swords.05", suit: "swords", rank: 5, element: "air" }),
  testCard({ id: "test.pents.07", suit: "pentacles", rank: 7, element: "earth" }),
  testCard({ id: "test.cups.page", suit: "cups", court: "page", element: "water" }),
  testCard({ id: "test.major.aa", arcana: "major", element: "fire" }),
  testCard({ id: "test.major.bb", arcana: "major", element: "water" }),
  testCard({ id: "test.major.cc", arcana: "major", element: "air" }),
]);

/**
 * Built here rather than borrowed from a real deck. The condition under test is
 * "this deck contains only major arcana" — a test that leans on whichever deck
 * happens to satisfy that today breaks the moment the deck data grows, which is
 * exactly what happened when the minor arcana landed.
 */
const MAJORS_ONLY_DECK = testDeck(
  [
    testCard({ id: "test.major.aa", arcana: "major", element: "fire" }),
    testCard({ id: "test.major.bb", arcana: "major", element: "water" }),
    testCard({ id: "test.major.cc", arcana: "major", element: "air" }),
  ],
  "majorsOnly",
);

describe("suitDominance", () => {
  it("should emit an insight when at least half the suited cards share a suit", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.cups.03"],
      ["test.wands.03"],
    ]);

    const [insight] = suitDominance.evaluate(ctx);

    expect(insight?.id).toBe("insight.suitDominance.cups");
  });

  it("should stay silent when no suit reaches half the suited cards", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    expect(suitDominance.evaluate(ctx)).toEqual([]);
  });

  it("should stay silent when fewer than three suited cards were drawn", () => {
    const ctx = contextFor(ONE_CARD, MIXED_DECK, [["test.cups.01"]]);

    expect(suitDominance.evaluate(ctx)).toEqual([]);
  });
});

describe("majorRatio", () => {
  it("should stay silent on a majors-only deck, where the ratio proves nothing", () => {
    // Every possible draw from such a deck is 100% major arcana. Reporting
    // that as a pattern would be noise dressed up as insight.
    const ctx = contextFor(THREE_CARDS, MAJORS_ONLY_DECK, [
      ["test.major.aa"],
      ["test.major.bb"],
      ["test.major.cc"],
    ]);

    expect(majorRatio.evaluate(ctx)).toEqual([]);
  });

  it("should emit the high insight when majors reach half of a mixed draw", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.major.aa"],
      ["test.major.bb"],
      ["test.cups.01"],
    ]);

    const [insight] = majorRatio.evaluate(ctx);

    expect(insight?.id).toBe("insight.majorRatio.high");
  });

  it("should emit the none insight when a mixed draw contains no majors", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    const [insight] = majorRatio.evaluate(ctx);

    expect(insight?.id).toBe("insight.majorRatio.none");
  });
});

describe("reversalRatio", () => {
  it("should emit an insight when at least 60% of the cards are reversed", () => {
    const ctx = contextFor(THREE_CARDS, riderWaite, [
      ["rw.major.00", "reversed"],
      ["rw.major.01", "reversed"],
      ["rw.major.02"],
    ]);

    const [insight] = reversalRatioRule.evaluate(ctx);

    expect(insight?.id).toBe("insight.reversalRatio.high");
  });

  it("should name only the reversed positions as its subjects", () => {
    const ctx = contextFor(THREE_CARDS, riderWaite, [
      ["rw.major.00", "reversed"],
      ["rw.major.01", "reversed"],
      ["rw.major.02"],
    ]);

    const [insight] = reversalRatioRule.evaluate(ctx);

    expect(insight?.subjects).toEqual(["pos.past", "pos.present"]);
  });

  it("should stay silent below the 60% threshold", () => {
    const ctx = contextFor(THREE_CARDS, riderWaite, [
      ["rw.major.00", "reversed"],
      ["rw.major.01"],
      ["rw.major.02"],
    ]);

    expect(reversalRatioRule.evaluate(ctx)).toEqual([]);
  });
});

describe("elementMissing", () => {
  it("should emit an insight when exactly one element is absent", () => {
    const ctx = contextFor(RELATIONSHIP_8, MIXED_DECK, [
      ["test.cups.01"],
      ["test.wands.03"],
      ["test.swords.05"],
      ["test.cups.03"],
      ["test.wands.03"],
      ["test.swords.05"],
      ["test.cups.10"],
      ["test.major.aa"],
    ]);

    const [insight] = elementMissing.evaluate(ctx);

    expect(insight?.id).toBe("insight.elementMissing.earth");
  });

  it("should stay silent when more than one element is absent", () => {
    // Absence stops being distinctive once most of the deck is missing.
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.cups.03"],
      ["test.cups.10"],
    ]);

    expect(elementMissing.evaluate(ctx)).toEqual([]);
  });

  it("should stay silent for a single-card spread", () => {
    const ctx = contextFor(ONE_CARD, MIXED_DECK, [["test.cups.01"]]);

    expect(elementMissing.evaluate(ctx)).toEqual([]);
  });
});

describe("numericEcho", () => {
  it("should emit an insight when two minor cards share a rank", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.03"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    const [insight] = numericEcho.evaluate(ctx);

    expect(insight?.id).toBe("insight.numericEcho");
  });

  it("should ignore major arcana, whose numbers are labels rather than stages", () => {
    const ctx = contextFor(THREE_CARDS, riderWaite, [
      ["rw.major.00"],
      ["rw.major.01"],
      ["rw.major.02"],
    ]);

    expect(numericEcho.evaluate(ctx)).toEqual([]);
  });
});

describe("aceOrTen", () => {
  it("should emit an insight when an ace or a ten is present", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    const [insight] = aceOrTen.evaluate(ctx);

    expect(insight?.id).toBe("insight.aceOrTen");
  });

  it("should stay silent when no ace or ten was drawn", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.03"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    expect(aceOrTen.evaluate(ctx)).toEqual([]);
  });
});

describe("courtPresence", () => {
  it("should emit an insight when a court card is present", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.page"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    const [insight] = courtPresence.evaluate(ctx);

    expect(insight?.id).toBe("insight.courtPresence");
  });

  it("should stay silent when no court card was drawn", () => {
    const ctx = contextFor(THREE_CARDS, MIXED_DECK, [
      ["test.cups.01"],
      ["test.wands.03"],
      ["test.swords.05"],
    ]);

    expect(courtPresence.evaluate(ctx)).toEqual([]);
  });
});
