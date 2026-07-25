import riderWaiteJson from "./rider-waite/deck.json" with { type: "json" };

import type { Card, Deck } from "./schema.js";

export * from "./schema.js";

/**
 * Deck data ships in the client bundle, so zod is deliberately NOT run at
 * import time — validation happens in `deck.test.ts` (`pnpm validate:decks`),
 * which is where a malformed card should be caught. That keeps the validator
 * out of the shipped bundle while still making bad data a build failure.
 *
 * The cast is safe precisely because the test enforces it.
 */
export const riderWaite = riderWaiteJson as unknown as Deck;

/** Raw JSON for the validation test to parse. */
export const RAW_DECKS: readonly unknown[] = [riderWaiteJson];

export const DECKS: Readonly<Record<string, Deck>> = {
  [riderWaite.id]: riderWaite,
};

const CARD_INDEX: ReadonlyMap<string, Card> = new Map(
  Object.values(DECKS).flatMap((deck) =>
    deck.cards.map((card) => [card.id, card] as const),
  ),
);

export function getDeck(deckId: string): Deck {
  const deck = DECKS[deckId];
  if (!deck) throw new Error(`Unknown deck "${deckId}"`);
  return deck;
}

export function getCard(cardId: string): Card {
  const card = CARD_INDEX.get(cardId);
  if (!card) throw new Error(`Unknown card "${cardId}"`);
  return card;
}

export function allCards(): readonly Card[] {
  return [...CARD_INDEX.values()];
}
