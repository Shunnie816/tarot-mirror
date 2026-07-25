import type { Spread, SpreadId } from "./types.js";

/**
 * MVP spreads, per PROJECT_OVERVIEW.
 *
 * `oraclePositions` is declared on every spread even though the MVP ships no
 * oracle deck. The overview asks for optional Oracle positions, and having the
 * slot defined now means adding a deck later is a data change, not a redesign.
 */

export const ONE_CARD: Spread = {
  id: "oneCard",
  labelId: "spread.oneCard",
  positions: [{ id: "pos.single", lens: "currentState" }],
  oraclePositions: [],
};

export const THREE_CARDS: Spread = {
  id: "threeCards",
  labelId: "spread.threeCards",
  positions: [
    { id: "pos.past", lens: "origin" },
    { id: "pos.present", lens: "currentState" },
    { id: "pos.future", lens: "trajectory" },
  ],
  oraclePositions: [{ id: "pos.oracle.advice", lens: "advice" }],
};

export const RELATIONSHIP_8: Spread = {
  id: "relationship8",
  labelId: "spread.relationship8",
  positions: [
    { id: "pos.self.past", lens: "origin", group: "self" },
    { id: "pos.self.present", lens: "currentState", group: "self" },
    { id: "pos.self.future", lens: "trajectory", group: "self" },
    { id: "pos.partner.past", lens: "origin", group: "partner" },
    { id: "pos.partner.present", lens: "currentState", group: "partner" },
    { id: "pos.partner.future", lens: "trajectory", group: "partner" },
    { id: "pos.relationship.catalyst", lens: "catalyst", group: "relationship" },
    { id: "pos.relationship.outcome", lens: "trajectory", group: "relationship" },
  ],
  oraclePositions: [
    { id: "pos.oracle.theme", lens: "theme" },
    { id: "pos.oracle.advice", lens: "advice" },
  ],
};

export const SPREADS: Readonly<Record<SpreadId, Spread>> = {
  oneCard: ONE_CARD,
  threeCards: THREE_CARDS,
  relationship8: RELATIONSHIP_8,
};

export function getSpread(id: SpreadId): Spread {
  return SPREADS[id];
}

export const ALL_SPREADS: readonly Spread[] = Object.values(SPREADS);
