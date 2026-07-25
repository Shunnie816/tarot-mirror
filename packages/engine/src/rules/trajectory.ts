import type { InsightId } from "@tarot-mirror/content";

import type { Insight, PositionGroup, PositionReading } from "../types.js";
import { AXES, clamp01, type Axis, type SpreadContext, type SpreadRule } from "./context.js";

/**
 * Movement across time.
 *
 * This is what the numeric `axes` on each card were designed for. A keyword
 * list can say what three cards mean individually; only a vector can say that
 * initiative is moving *toward* the user across those three cards. That
 * direction-of-travel is the part a reader actually acts on.
 */

/** Minimum change on an axis before it counts as a direction rather than noise. */
const SIGNIFICANT_DELTA = 2;

interface TemporalSequence {
  readonly key: PositionGroup | "overall";
  readonly from: PositionReading;
  readonly to: PositionReading;
}

/**
 * Find origin → trajectory runs.
 *
 * Works structurally off position lenses rather than hardcoded ids, so it
 * applies to the 3-card spread and to each side of the 8-card spread without
 * special cases.
 */
export function temporalSequences(ctx: SpreadContext): TemporalSequence[] {
  const groups = new Map<PositionGroup | "overall", PositionReading[]>();
  for (const reading of ctx.positions) {
    const key = reading.group ?? "overall";
    groups.set(key, [...(groups.get(key) ?? []), reading]);
  }

  const sequences: TemporalSequence[] = [];
  for (const [key, readings] of groups) {
    const from = readings.find((r) => r.lens === "origin");
    const to = readings.find((r) => r.lens === "trajectory");
    if (from && to) sequences.push({ key, from, to });
  }
  return sequences;
}

const INSIGHT_FOR_AXIS: Readonly<Record<Axis, { rising: InsightId; falling: InsightId }>> = {
  agency: {
    rising: "insight.trajectory.agencyRising",
    falling: "insight.trajectory.agencyFalling",
  },
  tempo: {
    rising: "insight.trajectory.tempoRising",
    falling: "insight.trajectory.tempoFalling",
  },
  friction: {
    rising: "insight.trajectory.frictionRising",
    falling: "insight.trajectory.frictionEasing",
  },
  focus: {
    rising: "insight.trajectory.turningInward",
    falling: "insight.trajectory.turningOutward",
  },
};

export const trajectory: SpreadRule = {
  id: "trajectory",
  scope: "any",
  weight: 0.9,
  evaluate(ctx) {
    const insights: Insight[] = [];

    for (const sequence of temporalSequences(ctx)) {
      // Report only the dominant movement per sequence. Emitting all four axes
      // would bury the signal and inflate the LLM's token budget for no gain.
      let strongestAxis: Axis | null = null;
      let strongestDelta = 0;

      for (const axis of AXES) {
        const delta = sequence.to.axes[axis] - sequence.from.axes[axis];
        if (Math.abs(delta) > Math.abs(strongestDelta)) {
          strongestDelta = delta;
          strongestAxis = axis;
        }
      }

      if (strongestAxis === null || Math.abs(strongestDelta) < SIGNIFICANT_DELTA) {
        continue;
      }

      const direction = strongestDelta > 0 ? "rising" : "falling";
      insights.push({
        id: INSIGHT_FOR_AXIS[strongestAxis][direction],
        subjects: [sequence.from.positionId, sequence.to.positionId],
        strength: clamp01(Math.abs(strongestDelta) / 4),
      });
    }

    return insights;
  },
};

export const TRAJECTORY_RULES: readonly SpreadRule[] = [trajectory];
