import { describe, expect, it } from "vitest";

import { ONE_CARD, RELATIONSHIP_8, THREE_CARDS } from "../spreads.js";
import { contextFor, testCard, testDeck } from "../testing.js";
import { temporalSequences, trajectory } from "./trajectory.js";

/**
 * These are the tests that justify putting numeric axes on cards at all: a
 * keyword list cannot express "initiative is moving toward you across these
 * three positions", and that direction is what a reader acts on.
 */

const DECK = testDeck([
  testCard({ id: "t.passive", axes: { agency: -2 } }),
  testCard({ id: "t.active", axes: { agency: 2 } }),
  testCard({ id: "t.neutral", axes: {} }),
  testCard({ id: "t.still", axes: { tempo: -2 } }),
  testCard({ id: "t.fast", axes: { tempo: 2 } }),
  testCard({ id: "t.rough", axes: { friction: 4 } }),
  testCard({ id: "t.smooth", axes: { friction: 0 } }),
  testCard({ id: "t.outward", axes: { focus: -2 } }),
  testCard({ id: "t.inward", axes: { focus: 2 } }),
  testCard({ id: "t.nudge", axes: { agency: 1 } }),
]);

describe("temporalSequences", () => {
  it("should find one sequence in a past-present-future spread", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
    ]);

    const sequences = temporalSequences(ctx);

    expect(sequences).toHaveLength(1);
    expect(sequences[0]?.key).toBe("overall");
  });

  it("should find a separate sequence for each side of the relationship spread", () => {
    const ctx = contextFor(RELATIONSHIP_8, DECK, [
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
      ["t.neutral"],
      ["t.neutral"],
    ]);

    const keys = temporalSequences(ctx).map((s) => s.key);

    expect(keys).toContain("self");
    expect(keys).toContain("partner");
  });

  it("should find no sequence in a single-card spread", () => {
    const ctx = contextFor(ONE_CARD, DECK, [["t.neutral"]]);

    expect(temporalSequences(ctx)).toEqual([]);
  });
});

describe("trajectory", () => {
  it("should report rising agency when initiative moves toward the querent", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
    ]);

    const [insight] = trajectory.evaluate(ctx);

    expect(insight?.id).toBe("insight.trajectory.agencyRising");
  });

  it("should report falling agency when initiative moves away", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.active"],
      ["t.neutral"],
      ["t.passive"],
    ]);

    const [insight] = trajectory.evaluate(ctx);

    expect(insight?.id).toBe("insight.trajectory.agencyFalling");
  });

  it("should report easing friction as its own direction", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.rough"],
      ["t.neutral"],
      ["t.smooth"],
    ]);

    const [insight] = trajectory.evaluate(ctx);

    expect(insight?.id).toBe("insight.trajectory.frictionEasing");
  });

  it("should report a turn inward when focus moves toward the self", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.outward"],
      ["t.neutral"],
      ["t.inward"],
    ]);

    const [insight] = trajectory.evaluate(ctx);

    expect(insight?.id).toBe("insight.trajectory.turningInward");
  });

  it("should report only the strongest axis, not every axis that moved", () => {
    // Agency moves 4, tempo moves 4 as well; only one observation should surface
    // so the reading stays legible.
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
    ]);

    expect(trajectory.evaluate(ctx)).toHaveLength(1);
  });

  it("should stay silent when the movement is below the significance threshold", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.neutral"],
      ["t.neutral"],
      ["t.nudge"],
    ]);

    expect(trajectory.evaluate(ctx)).toEqual([]);
  });

  it("should emit one insight per side in the relationship spread", () => {
    const ctx = contextFor(RELATIONSHIP_8, DECK, [
      ["t.passive"],
      ["t.neutral"],
      ["t.active"],
      ["t.rough"],
      ["t.neutral"],
      ["t.smooth"],
      ["t.neutral"],
      ["t.neutral"],
    ]);

    const ids = trajectory.evaluate(ctx).map((i) => i.id);

    expect(ids).toContain("insight.trajectory.agencyRising");
    expect(ids).toContain("insight.trajectory.frictionEasing");
  });
});
