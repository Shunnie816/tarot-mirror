import { COMPOSITION_RULES } from "./composition";
import { appliesTo, type SpreadContext, type SpreadRule } from "./context";
import { RELATIONSHIP_RULES } from "./relationship";
import { TENSION_RULES } from "./tension";
import { TRAJECTORY_RULES } from "./trajectory";

import type { Insight, SpreadId } from "../types";

export * from "./context";
export * from "./composition";
export * from "./relationship";
export * from "./tension";
export * from "./trajectory";

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
