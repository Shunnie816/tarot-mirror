import type { PositionId } from "@tarot-mirror/content";
import type { Card, Deck, Element } from "@tarot-mirror/decks";

import type {
  Insight,
  PositionGroup,
  PositionReading,
  Spread,
  SpreadId,
} from "../types";

/** Everything an L2 rule is allowed to look at. */
export interface SpreadContext {
  readonly spread: Spread;
  readonly positions: readonly PositionReading[];
  readonly cards: ReadonlyMap<PositionId, Card>;
  /**
   * The deck itself, so rules can tell whether a distribution is meaningful.
   *
   * This matters more than it looks: in a majors-only deck, "50%+ major
   * arcana" is true of every possible draw and therefore says nothing. Rules
   * check the deck's own composition before claiming a pattern.
   */
  readonly deck: Deck;
}

export interface SpreadRule {
  readonly id: string;
  /** Which spreads the rule applies to. */
  readonly scope: "any" | readonly SpreadId[];
  /** Base relevance, 0..1. Multiplied by the emitted insight's strength for ranking. */
  readonly weight: number;
  evaluate(ctx: SpreadContext): Insight[];
}

export function buildContext(
  spread: Spread,
  positions: readonly PositionReading[],
  deck: Deck,
): SpreadContext {
  // Resolve cards from the deck we were handed rather than a global registry,
  // so a rule can be exercised against a synthetic deck in tests.
  const byId = new Map(deck.cards.map((card) => [card.id, card]));

  return {
    spread,
    positions,
    deck,
    cards: new Map(
      positions.map((p) => {
        const card = byId.get(p.cardId);
        if (!card) {
          throw new Error(`Card "${p.cardId}" is not in deck "${deck.id}"`);
        }
        return [p.positionId, card];
      }),
    ),
  };
}

export function appliesTo(rule: SpreadRule, spreadId: SpreadId): boolean {
  return rule.scope === "any" || rule.scope.includes(spreadId);
}

// ── derived views ────────────────────────────────────────────────────────────

export function cardsOf(ctx: SpreadContext): Card[] {
  return ctx.positions.map((p) => ctx.cards.get(p.positionId)!);
}

export function readingsInGroup(
  ctx: SpreadContext,
  group: PositionGroup,
): PositionReading[] {
  return ctx.positions.filter((p) => p.group === group);
}

export function reversalRatio(ctx: SpreadContext): number {
  if (ctx.positions.length === 0) return 0;
  const reversed = ctx.positions.filter((p) => p.orientation === "reversed");
  return reversed.length / ctx.positions.length;
}

export function elementsPresent(ctx: SpreadContext): Set<Element> {
  return new Set(cardsOf(ctx).map((c) => c.element));
}

/** True when the deck contains both major and minor arcana. */
export function deckHasBothArcana(deck: Deck): boolean {
  let major = false;
  let minor = false;
  for (const card of deck.cards) {
    if (card.arcana === "major") major = true;
    else minor = true;
    if (major && minor) return true;
  }
  return false;
}

/** Elements the deck can actually produce — used to avoid false "missing" claims. */
export function deckElements(deck: Deck): Set<Element> {
  return new Set(deck.cards.map((c) => c.element));
}

export type Axis = "agency" | "tempo" | "friction" | "focus";

export const AXES: readonly Axis[] = ["agency", "tempo", "friction", "focus"];

export function meanAxes(
  readings: readonly PositionReading[],
): Record<Axis, number> {
  const total: Record<Axis, number> = { agency: 0, tempo: 0, friction: 0, focus: 0 };
  if (readings.length === 0) return total;

  for (const reading of readings) {
    for (const axis of AXES) total[axis] += reading.axes[axis];
  }
  for (const axis of AXES) total[axis] /= readings.length;
  return total;
}

/** Manhattan distance between two axis vectors. */
export function axisDistance(
  a: Record<Axis, number>,
  b: Record<Axis, number>,
): number {
  return AXES.reduce((sum, axis) => sum + Math.abs(a[axis] - b[axis]), 0);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
