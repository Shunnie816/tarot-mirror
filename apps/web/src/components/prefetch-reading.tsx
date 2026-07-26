"use client";

import type { ReadingJSON } from "@tarot-mirror/engine";

import { isFirebaseConfigured } from "@/lib/firebase/config";
import { usePrefetchFormatting } from "@/lib/format/use-prefetch";
import { useSession } from "@/lib/session/provider";

/**
 * カードを置いているあいだに、整形を先に頼んでおく。
 *
 * 整形は3枚で5〜7秒、8枚だと18秒かかる（実測）。読み物の手前でそれを待つと、
 * 本文を伏せたまま十数秒眺めさせることになり、文章が入れ替わるより悪い。
 * 一方この画面は、ひと組ずつ押して置いていく作りで、**利用者が意図的に
 * ゆっくり進んでいる時間**がすでにある。そこに重ねてしまえば、待ち時間は
 * どこにも現れない。
 *
 * 何も描かない。
 */
const ask = async (reading: ReadingJSON) => {
  if (!isFirebaseConfigured()) return;

  const { createCallablePort } = await import("@/lib/format/callable-port");
  return createCallablePort().format(reading, "ja");
};

export function PrefetchReading({
  reading,
  enabled,
}: {
  readonly reading: ReadingJSON;
  readonly enabled: boolean;
}) {
  const session = useSession();
  const uid = session.status === "ready" ? (session.user?.uid ?? null) : null;

  usePrefetchFormatting(reading, ask, { enabled, uid });

  return null;
}
