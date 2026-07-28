import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { drawCards } from "../draw";
import { interpretDraw } from "../interpret";
import { ALL_SPREADS } from "../spreads";
import type { SpreadId } from "../types";
import { appliesTo, buildContext } from "./context";
import { ALL_RULES } from "./index";

/**
 * Every rule must be reachable from the shipped deck.
 *
 * Rules that can never fire are worse than missing ones: they look like
 * coverage while contributing nothing. Four rules — suitDominance, numericEcho,
 * aceOrTen, courtPresence — were dormant for as long as the deck held only
 * major arcana, and nothing failed to say so. This test is what would have.
 *
 * Seeds are fixed, so the sweep is deterministic rather than flaky.
 */
describe("rule coverage over the shipped deck", () => {
  const firedRuleIds = (): Set<string> => {
    const fired = new Set<string>();

    for (const spread of ALL_SPREADS) {
      for (let i = 0; i < 400; i++) {
        const drawn = drawCards({ spread, deck: riderWaite, seed: `sweep-${i}` });
        const ctx = buildContext(
          spread,
          interpretDraw(spread, drawn),
          riderWaite,
        );

        for (const rule of ALL_RULES) {
          if (!appliesTo(rule, spread.id as SpreadId)) continue;
          if (rule.evaluate(ctx).length > 0) fired.add(rule.id);
        }
      }
    }

    return fired;
  };

  it("should be able to fire every rule at least once", () => {
    const fired = firedRuleIds();

    const neverFired = ALL_RULES.map((rule) => rule.id).filter(
      (id) => !fired.has(id),
    );

    expect(neverFired).toEqual([]);
  });
});
