import type { Deck } from "@tarot-mirror/decks";

import { createRng, shuffle, type Rng } from "./random";
import type { DrawnCard, Spread } from "./types";

export interface DrawOptions {
  readonly spread: Spread;
  readonly deck: Deck;
  readonly seed: string;
  /**
   * Reversals can be turned off per user preference — some people find them
   * discouraging, which works against the app's purpose.
   */
  readonly allowReversals?: boolean;
  /**
   * Chance a drawn card lands reversed. Ignored when `allowReversals` is false.
   *
   * Resolved as user preference, then the deck's own rate, then the default.
   * The person reading gets the last word: a deck can say what suits it, but
   * it cannot insist on a way of reading that someone has turned off.
   */
  readonly reversalRate?: number;
}

export class NotEnoughCardsError extends Error {
  constructor(needed: number, available: number) {
    super(`Spread needs ${needed} cards but the deck has ${available}`);
    this.name = "NotEnoughCardsError";
  }
}

const DEFAULT_REVERSAL_RATE = 0.3;

/**
 * L0 — draw one card per position.
 *
 * Pure and total: same seed and options always produce the same draw, and no
 * card is ever dealt twice.
 */
export function drawCards(options: DrawOptions): DrawnCard[] {
  const { spread, deck, seed, allowReversals = true } = options;
  const reversalRate =
    options.reversalRate ?? deck.reversalRate ?? DEFAULT_REVERSAL_RATE;

  const needed = spread.positions.length;
  if (deck.cards.length < needed) {
    throw new NotEnoughCardsError(needed, deck.cards.length);
  }

  const rng: Rng = createRng(seed);
  const shuffled = shuffle(deck.cards, rng);

  return spread.positions.map((position, index) => {
    const card = shuffled[index]!;
    // Draw the orientation roll for every card even when reversals are off,
    // so toggling the preference doesn't change which cards come up.
    const roll = rng();
    return {
      positionId: position.id,
      cardId: card.id,
      orientation:
        allowReversals && roll < reversalRate ? "reversed" : "upright",
    };
  });
}
