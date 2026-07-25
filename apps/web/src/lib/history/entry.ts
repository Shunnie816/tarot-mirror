import { type CopyResolver, interpolate } from "@tarot-mirror/content";
import { SPREADS, type SpreadId } from "@tarot-mirror/engine";

import { buildHref } from "@/lib/flow";
import type { StoredReading } from "@/lib/store/readings";

/**
 * 一覧に並べる1件ぶん。
 *
 * まとめない。傾向を出さない。日付・並べ方・引いたカードを、読んだときのまま置く。
 * 「あなたはこういう傾向です」と言った瞬間、気づくのは利用者ではなくアプリになる。
 * 同じカードに何度も会っていることに気づくのは、並べてある側の仕事ではない。
 */
export interface HistoryEntry {
  readonly id: string;
  /** 日付が読み取れないときは出さない。 */
  readonly dateLabel?: string;
  readonly spreadLabel: string;
  readonly question?: string;
  readonly cardNames: readonly string[];
  /** 同じ URL に戻る。seed が同じなら同じリーディングが再現される。 */
  readonly href: string;
}

function isKnownSpread(id: string): id is SpreadId {
  return Object.hasOwn(SPREADS, id);
}

function formatDate(resolver: CopyResolver, date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return interpolate(resolver.ui("ui.dateFormat"), {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
  });
}

/**
 * 保存されたリーディングを一覧の1行に落とす。
 *
 * 読み方が分からないものは `null`。デッキや並べ方は将来入れ替わりうるので、
 * 昔の記録が今の辞書に無いことは異常ではない。1件のために画面ごと失わない。
 */
export function toHistoryEntry(
  stored: StoredReading,
  resolver: CopyResolver,
): HistoryEntry | null {
  const { reading } = stored;
  if (!isKnownSpread(reading.spreadId)) return null;

  // サーバー時刻が確定していないあいだは、引いた時刻で代える。
  const date =
    stored.createdAt ??
    (reading.meta.drawnAt !== "" ? new Date(reading.meta.drawnAt) : null);
  const dateLabel = date === null ? null : formatDate(resolver, date);

  const cardNames = reading.positions
    .filter((position) => resolver.has("cards", position.cardId))
    .map((position) => resolver.card(position.cardId));

  return {
    id: stored.id,
    spreadLabel: resolver.spread(SPREADS[reading.spreadId].labelId),
    cardNames,
    href: buildHref("/reading", {
      spread: reading.spreadId,
      seed: reading.seed,
      ...(reading.question !== undefined ? { question: reading.question } : {}),
    }),
    ...(dateLabel !== null ? { dateLabel } : {}),
    ...(reading.question !== undefined ? { question: reading.question } : {}),
  };
}

export function toHistoryEntries(
  stored: readonly StoredReading[],
  resolver: CopyResolver,
): readonly HistoryEntry[] {
  return stored
    .map((entry) => toHistoryEntry(entry, resolver))
    .filter((entry): entry is HistoryEntry => entry !== null);
}
