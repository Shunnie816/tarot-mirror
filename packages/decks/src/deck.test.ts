import { describe, expect, it } from "vitest";

import { getResolver } from "@tarot-mirror/content";

import { allCards, RAW_DECKS, riderWaite } from "./index";
import { CardSchema, DeckSchema } from "./schema";

/**
 * Deck data integrity. Run in isolation via `pnpm validate:decks`.
 *
 * Deck JSON is hand-authored and ships to the client without runtime
 * validation, so these tests are the only thing standing between a typo and a
 * broken reading. They check two separate things:
 *
 *   1. Structural validity  (zod schema)
 *   2. Referential validity (every ID resolves to Japanese copy)
 *
 * (2) matters most: the engine emits IDs, so an unresolvable ID is invisible
 * until render time.
 */
describe("deck data", () => {
  it("should validate every deck against the schema", () => {
    for (const raw of RAW_DECKS) {
      const result = DeckSchema.safeParse(raw);
      expect(result.error?.issues ?? []).toEqual([]);
      expect(result.success).toBe(true);
    }
  });

  it("should contain all 22 major arcana in the Rider-Waite deck", () => {
    const majors = riderWaite.cards.filter((card) => card.arcana === "major");

    expect(majors).toHaveLength(22);
  });

  it("should number the major arcana contiguously from 00 to 21", () => {
    const numbers = riderWaite.cards
      .filter((card) => card.arcana === "major")
      .map((card) => card.id.split(".")[2])
      .sort();

    const expected = Array.from({ length: 22 }, (_, i) => String(i).padStart(2, "0"));
    expect(numbers).toEqual(expected);
  });

  it("should give every card a distinct keyword set per orientation", () => {
    for (const card of allCards()) {
      const shared = card.keywords.upright.filter((kw) =>
        card.keywords.reversed.includes(kw),
      );

      // A card whose orientations mean the same thing makes reversal
      // meaningless — the engine's axis transform would be the only signal.
      expect({ id: card.id, shared }).toEqual({ id: card.id, shared: [] });
    }
  });
});

describe("deck ↔ content referential integrity", () => {
  const resolver = getResolver("ja");

  it("should resolve every card id to a Japanese name", () => {
    const unresolved = allCards()
      .map((card) => card.id)
      .filter((id) => !resolver.has("cards", id));

    expect(unresolved).toEqual([]);
  });

  it("should resolve every keyword id referenced by a card", () => {
    const unresolved = allCards()
      .flatMap((card) => [...card.keywords.upright, ...card.keywords.reversed])
      .filter((id) => !resolver.has("keywords", id));

    expect([...new Set(unresolved)]).toEqual([]);
  });

  it("should resolve every theme id referenced by a card", () => {
    const unresolved = allCards()
      .flatMap((card) => card.themes)
      .filter((id) => !resolver.has("themes", id));

    expect([...new Set(unresolved)]).toEqual([]);
  });

  it("should resolve every reflection question id referenced by a card", () => {
    const unresolved = allCards()
      .flatMap((card) => card.reflectionSeeds)
      .filter((id) => !resolver.has("questions", id));

    expect([...new Set(unresolved)]).toEqual([]);
  });
});

describe("CardSchema", () => {
  const validMajor = riderWaite.cards[0];

  it("should reject a major arcana that declares a suit", () => {
    const result = CardSchema.safeParse({ ...validMajor, suit: "cups" });

    expect(result.success).toBe(false);
  });

  it("should reject a minor arcana that declares both rank and court", () => {
    const result = CardSchema.safeParse({
      ...validMajor,
      id: "rw.cups.11",
      arcana: "minor",
      suit: "cups",
      rank: 1,
      court: "page",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a friction value outside the 0..4 range", () => {
    const result = CardSchema.safeParse({
      ...validMajor,
      axes: { agency: 0, tempo: 0, friction: 5, focus: 0 },
    });

    expect(result.success).toBe(false);
  });
});
