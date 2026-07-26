import type { AxisVector } from "@tarot-mirror/decks";
import type { PositionReading, ReadingJSON } from "@tarot-mirror/engine";

/**
 * 保存されるリーディングの形。
 *
 * ReadingJSON をそのまま平らに置く。`drawn[]` や `deckIds` を別立てで持たせない
 * のは、どちらも positions と meta から導けるため。二重に持つと、いつか片方だけ
 * 直されて食い違う。カードデータを Firestore に置かないのと同じ判断で、
 * 導けるものは保存しない。
 *
 * テンプレートの本文も保存しない。readingJson と辞書があれば必ず同じ文章が
 * 再生成できる（0円・オフライン可）ので、保存する価値があるのは再生成できないもの、
 * つまり Phase 9 の LLM 出力だけになる。
 *
 * `createdAt` はここでは扱わない。サーバー時刻はリポジトリ層の責務。
 */

/** 読める版。上がったら、古い版は復元せず読み飛ばす。 */
export const READING_DOC_VERSION = 1;

/** Firestore は undefined を受け付けないので、任意項目は「鍵ごと無い」形にする。 */
type Storable = Record<string, unknown>;

/**
 * ドキュメント ID をリーディングそのものから決める。
 *
 * 同じ URL を開き直したときに同じ ID になるので、履歴が同じリーディングで
 * 埋まらない。決定性がそのまま冪等性になっている。
 *
 * seed は URL 経由で任意の文字列が入りうる。`/` が混ざるとパスが1階層深くなって
 * しまうため、ID に使う前に必ず通す。
 */
const MAX_SEED_LENGTH = 200;

export function readingDocId(
  reading: Pick<ReadingJSON, "spreadId" | "seed">,
): string {
  const seed = encodeURIComponent(reading.seed.slice(0, MAX_SEED_LENGTH));
  return `${reading.spreadId}-${seed}`;
}

function storeAxes(axes: AxisVector): Storable {
  return {
    agency: axes.agency,
    tempo: axes.tempo,
    friction: axes.friction,
    focus: axes.focus,
  };
}

function storePosition(position: PositionReading): Storable {
  return {
    positionId: position.positionId,
    cardId: position.cardId,
    orientation: position.orientation,
    lens: position.lens,
    keywords: [...position.keywords],
    framing: position.framing,
    axes: storeAxes(position.axes),
    ...(position.group !== undefined ? { group: position.group } : {}),
  };
}

/**
 * 保存する形に落とす。
 *
 * ReadingJSON をそのまま渡さず1つずつ書き写しているのは、保存される形を
 * エンジンの都合から切り離すため。エンジンに項目が増えても、保存の形は
 * このファイルを直すまで変わらない。
 */
export function toReadingDoc(reading: ReadingJSON): Storable {
  return {
    version: READING_DOC_VERSION,
    seed: reading.seed,
    spreadId: reading.spreadId,
    positions: reading.positions.map(storePosition),
    insights: reading.insights.map((insight) => ({
      id: insight.id,
      subjects: [...insight.subjects],
      strength: insight.strength,
    })),
    reflection: [...reading.reflection],
    meta: {
      deckIds: [...reading.meta.deckIds],
      drawnAt: reading.meta.drawnAt,
    },
    ...(reading.question !== undefined ? { question: reading.question } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 保存された形から読み戻す。
 *
 * 全項目を検証はしない。ここに書けるのは本人だけなので、守る相手がいない。
 * 見るのは「読める版か」「復元に足りているか」だけで、それを外したものは
 * 直さずに null を返す（壊れたものを画面に出すより、無かったことにする）。
 */
export function fromReadingDoc(data: unknown): ReadingJSON | null {
  if (!isRecord(data)) return null;
  if (data["version"] !== READING_DOC_VERSION) return null;

  const { seed, spreadId, positions, question } = data;
  if (typeof seed !== "string" || typeof spreadId !== "string") return null;
  if (!Array.isArray(positions)) return null;

  const meta = isRecord(data["meta"]) ? data["meta"] : {};

  return {
    version: 1,
    seed,
    spreadId: spreadId as ReadingJSON["spreadId"],
    positions: positions as ReadingJSON["positions"],
    insights: (Array.isArray(data["insights"])
      ? data["insights"]
      : []) as ReadingJSON["insights"],
    reflection: (Array.isArray(data["reflection"])
      ? data["reflection"]
      : []) as ReadingJSON["reflection"],
    meta: {
      deckIds: (Array.isArray(meta["deckIds"])
        ? meta["deckIds"]
        : []) as readonly string[],
      drawnAt: typeof meta["drawnAt"] === "string" ? meta["drawnAt"] : "",
    },
    ...(typeof question === "string" ? { question } : {}),
  };
}
