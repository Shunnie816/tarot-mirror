import { describe, expect, it } from "vitest";

import { RELATIONSHIP_8, THREE_CARDS } from "../spreads.js";
import { contextFor, testCard, testDeck } from "../testing.js";
import { bridge, mirroring } from "./relationship.js";

const DECK = testDeck([
  testCard({ id: "t.neutral", axes: {} }),
  testCard({ id: "t.near", axes: { agency: 1 } }),
  // Manhattan distance 4 from neutral — inside the complement band (3..6).
  testCard({ id: "t.moderate", axes: { agency: 2, tempo: 1, friction: 1, focus: 0 } }),
  // Distance 9 from neutral — beyond the complement band.
  testCard({ id: "t.far", axes: { agency: 2, tempo: 2, friction: 3, focus: 2 } }),
  testCard({ id: "t.opposite", axes: { agency: -2, tempo: -2, friction: 0, focus: -2 } }),
  testCard({ id: "t.selfTheme", themes: ["theme.inward"] }),
  testCard({ id: "t.partnerTheme", themes: ["theme.connection"] }),
  testCard({ id: "t.catalystInward", themes: ["theme.inward"] }),
  testCard({ id: "t.catalystBoth", themes: ["theme.inward", "theme.connection"] }),
  testCard({ id: "t.catalystNone", themes: ["theme.cycle"] }),
]);

/** Fill the 8 slots: 3 self, 3 partner, catalyst, outcome. */
const layout = (
  self: string,
  partner: string,
  catalyst: string,
): ReadonlyArray<readonly [string]> => [
  [self],
  [self],
  [self],
  [partner],
  [partner],
  [partner],
  [catalyst],
  ["t.neutral"],
];

describe("mirroring", () => {
  it("should report resonance when both sides sit in a similar place", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.neutral", "t.neutral", "t.neutral"),
    );

    const [insight] = mirroring.evaluate(ctx);

    expect(insight?.id).toBe("insight.mirroring.resonance");
  });

  it("should report complement when the sides differ moderately", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.neutral", "t.moderate", "t.neutral"),
    );

    const [insight] = mirroring.evaluate(ctx);

    expect(insight?.id).toBe("insight.mirroring.complement");
  });

  it("should report divergence when the sides sit far apart", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.far", "t.opposite", "t.neutral"),
    );

    const [insight] = mirroring.evaluate(ctx);

    expect(insight?.id).toBe("insight.mirroring.divergence");
  });

  it("should not apply to spreads without two sides", () => {
    expect(mirroring.scope).toEqual(["relationship8"]);
    expect(THREE_CARDS.positions.every((p) => p.group === undefined)).toBe(true);
  });
});

describe("bridge", () => {
  it("should point to the querent's side when the catalyst shares their themes", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.selfTheme", "t.partnerTheme", "t.catalystInward"),
    );

    const [insight] = bridge.evaluate(ctx);

    expect(insight?.id).toBe("insight.bridge.self");
  });

  it("should point to the partner's side when the catalyst shares their themes", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.partnerTheme", "t.selfTheme", "t.catalystInward"),
    );

    const [insight] = bridge.evaluate(ctx);

    expect(insight?.id).toBe("insight.bridge.partner");
  });

  it("should report a shared bridge when the catalyst touches both sides equally", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.selfTheme", "t.partnerTheme", "t.catalystBoth"),
    );

    const [insight] = bridge.evaluate(ctx);

    expect(insight?.id).toBe("insight.bridge.shared");
  });

  it("should stay silent when the catalyst shares no theme with either side", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.selfTheme", "t.partnerTheme", "t.catalystNone"),
    );

    expect(bridge.evaluate(ctx)).toEqual([]);
  });

  it("should name the catalyst position as its subject", () => {
    const ctx = contextFor(
      RELATIONSHIP_8,
      DECK,
      layout("t.selfTheme", "t.partnerTheme", "t.catalystInward"),
    );

    const [insight] = bridge.evaluate(ctx);

    expect(insight?.subjects).toEqual(["pos.relationship.catalyst"]);
  });
});
