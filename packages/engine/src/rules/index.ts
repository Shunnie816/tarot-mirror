import { COMPOSITION_RULES } from "./composition.js";
import { appliesTo, type SpreadContext, type SpreadRule } from "./context.js";
import { RELATIONSHIP_RULES } from "./relationship.js";
import { TENSION_RULES } from "./tension.js";
import { TRAJECTORY_RULES } from "./trajectory.js";

import type { Insight, SpreadId } from "../types.js";

export * from "./context.js";
export * from "./composition.js";
export * from "./relationship.js";
export * from "./tension.js";
export * from "./trajectory.js";

export const ALL_RULES: readonly SpreadRule[] = [
  ...COMPOSITION_RULES,
  ...TRAJECTORY_RULES,
  ...RELATIONSHIP_RULES,
  ...TENSION_RULES,
];

export interface RankedInsight extends Insight {
  /** rule weight × insight strength — the ranking key used by L3. */
  readonly score: number;
  readonly ruleId: string;
}

/** Run every in-scope rule and return its insights, unranked. */
export function evaluateRules(
  ctx: SpreadContext,
  rules: readonly SpreadRule[] = ALL_RULES,
): RankedInsight[] {
  const results: RankedInsight[] = [];

  for (const rule of rules) {
    if (!appliesTo(rule, ctx.spread.id as SpreadId)) continue;

    for (const insight of rule.evaluate(ctx)) {
      results.push({
        ...insight,
        ruleId: rule.id,
        score: rule.weight * insight.strength,
      });
    }
  }

  return results;
}
