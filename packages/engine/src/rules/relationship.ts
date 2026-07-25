import type { Insight } from "../types.js";
import {
  axisDistance,
  clamp01,
  meanAxes,
  readingsInGroup,
  type SpreadRule,
} from "./context.js";

/**
 * Rules that only make sense when a spread has two sides.
 *
 * The 8-card relationship spread splits into `self` (1–3), `partner` (4–6) and
 * `relationship` (7–8). Comparing the two personal sides as axis vectors gives
 * us something a per-card reading cannot: whether the two people are in a
 * similar place, an opposite one, or simply looking at different things.
 */

/** Manhattan distance on 4 axes runs 0..~14. These split it into three bands. */
const RESONANCE_MAX = 2;
const COMPLEMENT_MAX = 6;

export const mirroring: SpreadRule = {
  id: "mirroring",
  scope: ["relationship8"],
  weight: 0.95,
  evaluate(ctx) {
    const self = readingsInGroup(ctx, "self");
    const partner = readingsInGroup(ctx, "partner");
    if (self.length === 0 || partner.length === 0) return [];

    const distance = axisDistance(meanAxes(self), meanAxes(partner));
    const subjects = [...self, ...partner].map((r) => r.positionId);

    if (distance <= RESONANCE_MAX) {
      return [
        {
          id: "insight.mirroring.resonance",
          subjects,
          strength: clamp01(1 - distance / RESONANCE_MAX),
        },
      ];
    }
    if (distance <= COMPLEMENT_MAX) {
      return [{ id: "insight.mirroring.complement", subjects, strength: 0.7 }];
    }
    return [
      {
        id: "insight.mirroring.divergence",
        subjects,
        strength: clamp01((distance - COMPLEMENT_MAX) / COMPLEMENT_MAX),
      },
    ];
  },
};

/**
 * Where the movement in a relationship is coming from.
 *
 * Position 7 is the catalyst. If its themes overlap one side's cards more than
 * the other's, that suggests which side the next move belongs to — a genuinely
 * actionable observation, and one no single card could produce.
 */
export const bridge: SpreadRule = {
  id: "bridge",
  scope: ["relationship8"],
  weight: 0.85,
  evaluate(ctx) {
    const catalyst = ctx.positions.find((p) => p.lens === "catalyst");
    if (!catalyst) return [];

    const catalystCard = ctx.cards.get(catalyst.positionId);
    if (!catalystCard) return [];
    const catalystThemes = new Set(catalystCard.themes);

    const overlapWith = (group: "self" | "partner"): number =>
      readingsInGroup(ctx, group)
        .map((r) => ctx.cards.get(r.positionId))
        .filter((card) => card !== undefined)
        .reduce(
          (count, card) =>
            count + card.themes.filter((t) => catalystThemes.has(t)).length,
          0,
        );

    const selfOverlap = overlapWith("self");
    const partnerOverlap = overlapWith("partner");
    if (selfOverlap === 0 && partnerOverlap === 0) return [];

    const subjects = [catalyst.positionId];
    const total = selfOverlap + partnerOverlap;

    if (selfOverlap === partnerOverlap) {
      return [{ id: "insight.bridge.shared", subjects, strength: 0.6 }];
    }

    const leaning = selfOverlap > partnerOverlap ? "self" : "partner";
    return [
      {
        id: `insight.bridge.${leaning}`,
        subjects,
        strength: clamp01(Math.abs(selfOverlap - partnerOverlap) / total),
      },
    ];
  },
};

export const RELATIONSHIP_RULES: readonly SpreadRule[] = [mirroring, bridge];
