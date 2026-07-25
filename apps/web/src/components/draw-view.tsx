"use client";

import { getResolver, interpolate, type Locale } from "@tarot-mirror/content";
import type { SpreadId } from "@tarot-mirror/engine";
import Link from "next/link";
import { useState } from "react";

import { Board } from "@/components/board";
import { buildHref } from "@/lib/flow";
import { countLabel, type ReadingGroup } from "@/lib/groups";

/**
 * ひと組ずつ置く。8枚でも操作は3回。
 *
 * 1枚ずつめくらせると8回になり、意図的にめくる行為が単なる作業になる。
 * 置かれた組は1枚ずつ少しずらして現れる（--motion-stagger）。
 */
export function DrawView({
  groups,
  locale,
  spread,
  seed,
  question,
}: {
  readonly groups: readonly ReadingGroup[];
  readonly locale: Locale;
  readonly spread: SpreadId;
  readonly seed: string;
  readonly question?: string;
}) {
  const resolver = getResolver(locale);
  const [placedCount, setPlacedCount] = useState(0);

  const next = groups[placedCount];
  const justPlaced = placedCount > 0 ? groups[placedCount - 1] : undefined;

  const status = (() => {
    if (justPlaced === undefined) return resolver.ui("ui.drawStatusEmpty");
    if (next === undefined) return resolver.ui("ui.drawStatusDone");
    return justPlaced.label !== undefined
      ? interpolate(resolver.ui("ui.drawStatusPlaced"), {
          group: justPlaced.label,
        })
      : resolver.ui("ui.drawStatusPlacedUnnamed");
  })();

  return (
    <>
      <Board
        groups={groups}
        locale={locale}
        placedCount={placedCount}
        staggerGroupIndex={placedCount - 1}
      />

      <div className="draw-controls">
        <p className="screen-status">{status}</p>

        {next !== undefined && (
          <button
            type="button"
            className="button button--outline button--block"
            onClick={() => setPlacedCount((n) => n + 1)}
          >
            {next.label !== undefined
              ? interpolate(resolver.ui("ui.drawPlaceGroup"), {
                  group: next.label,
                })
              : interpolate(resolver.ui("ui.drawPlaceUnnamed"), {
                  count: countLabel(resolver, next.positions.length),
                })}
          </button>
        )}

        {next === undefined && (
          <Link
            className="button button--solid button--block"
            href={buildHref("/reading", {
              spread,
              seed,
              ...(question !== undefined ? { question } : {}),
            })}
          >
            {resolver.ui("ui.drawStart")}
          </Link>
        )}

        <span className="screen-note">{resolver.ui("ui.reversedHint")}</span>
      </div>
    </>
  );
}
