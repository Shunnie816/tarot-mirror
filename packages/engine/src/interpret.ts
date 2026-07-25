import type { KeywordId } from "@tarot-mirror/content";
import { getCard, type AxisVector, type Card } from "@tarot-mirror/decks";

import type {
  DrawnCard,
  Orientation,
  PositionLens,
  PositionReading,
  Spread,
  SpreadPosition,
} from "./types.js";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * The reversal transform.
 *
 * We deliberately do NOT treat reversed as "the opposite meaning" — that
 * reading is crude and often wrong. Instead a reversal consistently means
 * *internalized, held back, not yet*: attention turns inward, movement slows,
 * resistance rises, and initiative recedes.
 *
 * Expressing it as one rule over the axes is what saves us from hand-authoring
 * 78 × 2 separate interpretations, and keeps reversal behaviour consistent
 * across every card in every deck.
 */
export function applyReversal(axes: AxisVector): AxisVector {
  return {
    agency: clamp(axes.agency - 1, -2, 2),
    tempo: clamp(axes.tempo - 1, -2, 2),
    friction: clamp(axes.friction + 1, 0, 4),
    focus: clamp(axes.focus + 1, -2, 2),
  };
}

/**
 * Per-lens emphasis offset.
 *
 * A card's keywords carry no per-lens affinity metadata, so we do not pretend
 * to rank them semantically. What we do instead is rotate the emphasis: the
 * same card leads with a different keyword depending on the slot it landed in,
 * deterministically. That gives varied, non-repetitive readings without
 * inventing semantics the data doesn't contain.
 *
 * Upgrade path: add a `lensAffinity` field to keywords and replace the
 * rotation with a real ranking. `selectKeywords` is the only thing that
 * changes.
 */
const LENS_ROTATION: Readonly<Record<PositionLens, number>> = {
  origin: 0,
  currentState: 0,
  trajectory: 1,
  advice: 2,
  catalyst: 1,
  theme: 2,
};

export const MAX_KEYWORDS_PER_POSITION = 3;

export function selectKeywords(
  card: Card,
  orientation: Orientation,
  lens: PositionLens,
): KeywordId[] {
  const pool = (
    orientation === "upright" ? card.keywords.upright : card.keywords.reversed
  ) as KeywordId[];

  const offset = LENS_ROTATION[lens] % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, MAX_KEYWORDS_PER_POSITION);
}

export function framingIdFor(lens: PositionLens, orientation: Orientation) {
  return `framing.${lens}.${orientation}` as const;
}

/**
 * L1 — read one card through one position.
 *
 * Pure: given the same card, orientation and position, the output never varies.
 */
export function interpretPosition(
  card: Card,
  orientation: Orientation,
  position: SpreadPosition,
): PositionReading {
  const axes =
    orientation === "reversed" ? applyReversal(card.axes) : { ...card.axes };

  return {
    positionId: position.id,
    cardId: card.id,
    orientation,
    lens: position.lens,
    ...(position.group !== undefined ? { group: position.group } : {}),
    keywords: selectKeywords(card, orientation, position.lens),
    framing: framingIdFor(position.lens, orientation),
    axes,
  };
}

/**
 * Interpret a whole draw. Throws if a drawn card doesn't match the spread.
 *
 * `lookup` is injectable so rules and renderers can be exercised against a
 * synthetic deck without registering it globally.
 */
export function interpretDraw(
  spread: Spread,
  drawn: readonly DrawnCard[],
  lookup: (cardId: string) => Card = getCard,
): PositionReading[] {
  const byPosition = new Map(drawn.map((d) => [d.positionId, d]));

  return spread.positions.map((position) => {
    const card = byPosition.get(position.id);
    if (!card) {
      throw new Error(`No card drawn for position "${position.id}"`);
    }
    return interpretPosition(lookup(card.cardId), card.orientation, position);
  });
}
