"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import { generateSeed, type SpreadId } from "@tarot-mirror/engine";
import { useRouter } from "next/navigation";

/**
 * ここで seed を決める。以降ドローとリーディングは同じ seed を URL で引き継ぐので、
 * 同じ URL を開けば必ず同じ引きが再現される。
 */
export function SpreadPicker({
  locale,
  spread,
  question,
}: {
  readonly locale: Locale;
  readonly spread: SpreadId;
  readonly question?: string;
}) {
  const resolver = getResolver(locale);
  const router = useRouter();

  return (
    <button
      type="button"
      className="button button--outline button--inline"
      onClick={() => {
        const search = new URLSearchParams({ spread, seed: generateSeed() });
        if (question !== undefined && question.length > 0) {
          search.set("q", question);
        }
        router.push(`/draw?${search.toString()}`);
      }}
    >
      {resolver.ui("ui.spreadPick")}
    </button>
  );
}
