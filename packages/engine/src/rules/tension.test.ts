import { describe, expect, it } from "vitest";

import { ONE_CARD, THREE_CARDS } from "../spreads";
import { contextFor, testCard, testDeck } from "../testing";
import { tensionPair } from "./tension";

const DECK = testDeck([
  testCard({ id: "t.pushing", axes: { agency: 2, friction: 0 } }),
  testCard({ id: "t.yielding", axes: { agency: -2, friction: 0 } }),
  testCard({ id: "t.smooth", axes: { agency: 0, friction: 0 } }),
  testCard({ id: "t.rough", axes: { agency: 0, friction: 4 } }),
  testCard({ id: "t.mild", axes: { agency: 1, friction: 1 } }),
]);

describe("tensionPair", () => {
  it("should report tension when adjacent positions pull in opposite directions on agency", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.pushing"],
      ["t.yielding"],
      ["t.smooth"],
    ]);

    const ids = tensionPair.evaluate(ctx).map((i) => i.id);

    expect(ids).toContain("insight.tensionPair.agency");
  });

  it("should report tension when adjacent positions differ sharply on friction", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.smooth"],
      ["t.rough"],
      ["t.smooth"],
    ]);

    const ids = tensionPair.evaluate(ctx).map((i) => i.id);

    expect(ids).toContain("insight.tensionPair.friction");
  });

  it("should name the two adjacent positions as its subjects", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.pushing"],
      ["t.yielding"],
      ["t.smooth"],
    ]);

    const [insight] = tensionPair.evaluate(ctx);

    expect(insight?.subjects).toEqual(["pos.past", "pos.present"]);
  });

  it("should report each kind of tension at most once per reading", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.pushing"],
      ["t.yielding"],
      ["t.pushing"],
    ]);

    const agencyInsights = tensionPair
      .evaluate(ctx)
      .filter((i) => i.id === "insight.tensionPair.agency");

    expect(agencyInsights).toHaveLength(1);
  });

  it("should stay silent when adjacent positions are close together", () => {
    const ctx = contextFor(THREE_CARDS, DECK, [
      ["t.smooth"],
      ["t.mild"],
      ["t.smooth"],
    ]);

    expect(tensionPair.evaluate(ctx)).toEqual([]);
  });

  it("should stay silent for a single-card spread, which has no adjacency", () => {
    const ctx = contextFor(ONE_CARD, DECK, [["t.pushing"]]);

    expect(tensionPair.evaluate(ctx)).toEqual([]);
  });
});
