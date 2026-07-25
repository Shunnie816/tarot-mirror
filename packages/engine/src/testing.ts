import type { AxisVector, Card, Deck } from "@tarot-mirror/decks";

import { interpretDraw } from "./interpret.js";
import { buildContext, type SpreadContext } from "./rules/context.js";
import type { Orientation, Spread } from "./types.js";

/**
 * Test-only builders.
 *
 * L2 rules reason about deck composition — suits, ranks, courts, elements — so
 * exercising them needs decks the MVP doesn't ship yet. Building synthetic
 * cards here lets each rule be tested against exactly the distribution it
 * cares about, rather than hunting for a real draw that happens to trigger it.
 *
 * Not exported from the package index; nothing in `src/index.ts` imports it.
 */

const DEFAULT_AXES = { agency: 0, tempo: 0, friction: 0, focus: 0 } as const;

export interface TestCardSpec {
  readonly id: string;
  readonly arcana?: "major" | "minor";
  readonly suit?: Card["suit"];
  readonly rank?: number;
  readonly court?: Card["court"];
  readonly element?: Card["element"];
  readonly themes?: readonly string[];
  readonly axes?: Partial<AxisVector>;
}

export function testCard(spec: TestCardSpec): Card {
  const arcana = spec.arcana ?? (spec.suit ? "minor" : "major");

  return {
    id: spec.id,
    arcana,
    ...(spec.suit !== undefined ? { suit: spec.suit } : {}),
    ...(spec.rank !== undefined ? { rank: spec.rank } : {}),
    ...(spec.court !== undefined ? { court: spec.court } : {}),
    element: spec.element ?? "fire",
    keywords: {
      upright: ["kw.beginning", "kw.leap", "kw.innocence"],
      reversed: ["kw.hesitation", "kw.unpreparedness", "kw.recklessness"],
    },
    themes: (spec.themes ?? ["theme.movement"]) as Card["themes"],
    reflectionSeeds: ["q.whatAreYouHolding", "q.whatSmallStepIsAvailable"],
    axes: { ...DEFAULT_AXES, ...spec.axes },
  } as Card;
}

export function testDeck(cards: readonly Card[], id = "test"): Deck {
  return { id, kind: "tarot", cards: [...cards] } as Deck;
}

/**
 * Build a rule context by dealing the given cards into the spread in order.
 * Entries are `[cardId, orientation?]`.
 */
export function contextFor(
  spread: Spread,
  deck: Deck,
  entries: ReadonlyArray<readonly [string, Orientation?]>,
): SpreadContext {
  const drawn = spread.positions.map((position, index) => {
    const entry = entries[index];
    if (!entry) {
      throw new Error(`No test entry for position index ${index}`);
    }
    return {
      positionId: position.id,
      cardId: entry[0],
      orientation: entry[1] ?? ("upright" as Orientation),
    };
  });

  const byId = new Map(deck.cards.map((card) => [card.id, card]));
  const positions = interpretDraw(spread, drawn, (id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`Test deck has no card "${id}"`);
    return card;
  });

  return buildContext(spread, positions, deck);
}
