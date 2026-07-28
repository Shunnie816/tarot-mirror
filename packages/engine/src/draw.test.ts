import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { drawCards, NotEnoughCardsError } from "./draw";
import { ONE_CARD, RELATIONSHIP_8, THREE_CARDS } from "./spreads";

describe("drawCards", () => {
  const base = { spread: THREE_CARDS, deck: riderWaite } as const;

  it("should produce the same draw for the same seed", () => {
    const first = drawCards({ ...base, seed: "seed-a" });
    const second = drawCards({ ...base, seed: "seed-a" });

    expect(second).toEqual(first);
  });

  it("should produce a different draw for a different seed", () => {
    const first = drawCards({ ...base, seed: "seed-a" });
    const second = drawCards({ ...base, seed: "seed-b" });

    expect(second).not.toEqual(first);
  });

  it("should draw one card per position in the spread", () => {
    const drawn = drawCards({ ...base, spread: RELATIONSHIP_8, seed: "s" });

    expect(drawn.map((d) => d.positionId)).toEqual(
      RELATIONSHIP_8.positions.map((p) => p.id),
    );
  });

  it("should never deal the same card twice", () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawCards({ ...base, spread: RELATIONSHIP_8, seed: `s${i}` });
      const ids = drawn.map((d) => d.cardId);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("should draw only upright cards when reversals are disabled", () => {
    for (let i = 0; i < 50; i++) {
      const drawn = drawCards({
        ...base,
        spread: RELATIONSHIP_8,
        seed: `s${i}`,
        allowReversals: false,
      });

      expect(drawn.every((d) => d.orientation === "upright")).toBe(true);
    }
  });

  it("should draw the same cards regardless of the reversal preference", () => {
    // Toggling reversals is a display-level preference; it must not change
    // which cards the user drew.
    const withReversals = drawCards({ ...base, seed: "s", allowReversals: true });
    const without = drawCards({ ...base, seed: "s", allowReversals: false });

    expect(without.map((d) => d.cardId)).toEqual(
      withReversals.map((d) => d.cardId),
    );
  });

  it("should produce reversed cards at roughly the configured rate", () => {
    const draws = Array.from({ length: 400 }, (_, i) =>
      drawCards({ ...base, spread: ONE_CARD, seed: `rate-${i}`, reversalRate: 0.3 }),
    ).flat();

    const reversed = draws.filter((d) => d.orientation === "reversed").length;
    const ratio = reversed / draws.length;

    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.4);
  });

  /**
   * オラクルデッキには「逆位置の意味」が無い。呼び出し側が毎回それを
   * 覚えている前提にせず、デッキ自身に言わせる。
   */
  it("should honour a rate the deck declares for itself", () => {
    const uprightOnly = { ...riderWaite, reversalRate: 0 };

    for (let i = 0; i < 50; i++) {
      const drawn = drawCards({
        spread: RELATIONSHIP_8,
        deck: uprightOnly,
        seed: `deck-rate-${i}`,
      });

      expect(drawn.every((d) => d.orientation === "upright")).toBe(true);
    }
  });

  /** 読む人が最後に決める。デッキは似合う読み方を言えるが、押しつけられない。 */
  it("should let the reader's rate override the deck's", () => {
    const neverReversed = { ...riderWaite, reversalRate: 0 };

    const drawn = Array.from({ length: 200 }, (_, i) =>
      drawCards({
        spread: ONE_CARD,
        deck: neverReversed,
        seed: `override-${i}`,
        reversalRate: 1,
      }),
    ).flat();

    expect(drawn.every((d) => d.orientation === "reversed")).toBe(true);
  });

  it("should throw when the deck has fewer cards than the spread needs", () => {
    const tinyDeck = { ...riderWaite, cards: riderWaite.cards.slice(0, 2) };

    expect(() =>
      drawCards({ spread: RELATIONSHIP_8, deck: tinyDeck, seed: "s" }),
    ).toThrow(NotEnoughCardsError);
  });
});
