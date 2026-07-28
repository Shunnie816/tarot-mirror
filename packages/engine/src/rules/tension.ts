import type { Insight } from "../types";
import { clamp01, type SpreadRule } from "./context";

/**
 * Contradictions sitting next to each other.
 *
 * Naming a tension is one of the most useful things a reflective app can do —
 * "you want to push and to let go at the same time" is often the thing the
 * user came to articulate. Framing matters: the copy presents the tension as
 * unremarkable rather than as a problem to fix.
 */

/** How far apart two adjacent positions must sit before it reads as tension. */
const TENSION_THRESHOLD = 3;

export const tensionPair: SpreadRule = {
  id: "tensionPair",
  scope: "any",
  weight: 0.65,
  evaluate(ctx) {
    if (ctx.positions.length < 2) return [];

    const insights: Insight[] = [];
    let reportedAgency = false;
    let reportedFriction = false;

    for (let i = 0; i < ctx.positions.length - 1; i++) {
      const a = ctx.positions[i]!;
      const b = ctx.positions[i + 1]!;

      const agencyGap = Math.abs(a.axes.agency - b.axes.agency);
      if (!reportedAgency && agencyGap >= TENSION_THRESHOLD) {
        reportedAgency = true;
        insights.push({
          id: "insight.tensionPair.agency",
          subjects: [a.positionId, b.positionId],
          strength: clamp01(agencyGap / 4),
        });
      }

      const frictionGap = Math.abs(a.axes.friction - b.axes.friction);
      if (!reportedFriction && frictionGap >= TENSION_THRESHOLD) {
        reportedFriction = true;
        insights.push({
          id: "insight.tensionPair.friction",
          subjects: [a.positionId, b.positionId],
          strength: clamp01(frictionGap / 4),
        });
      }
    }

    return insights;
  },
};

export const TENSION_RULES: readonly SpreadRule[] = [tensionPair];
