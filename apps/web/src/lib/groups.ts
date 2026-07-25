import type { CopyResolver } from "@tarot-mirror/content";
import type { RenderedPosition, RenderedReading } from "@tarot-mirror/engine";

/**
 * 盤面と段階開示の単位。
 *
 * エンジンは各ポジションがどちらの側に属するかを持っているが、「側を持たない
 * スプレッドは1つの群として扱う」のは表示側の判断なのでここで決める。
 *
 * この単位にしたことで、8枚を読み終えるのに必要な操作が8回から3回になり、
 * 同時に群が視覚的に立つ。開示の単位がデータ構造と一致している。
 */
export interface ReadingGroup {
  readonly key: string;
  /** 側を持たないスプレッドでは見出しを出さない。 */
  readonly label?: string;
  readonly note?: string;
  /** 脇に置かれる群（二人のあいだ）。盤面で本体の横に出る。 */
  readonly isSide: boolean;
  readonly positions: readonly RenderedPosition[];
}

const UNGROUPED = "__ungrouped";

/** 本文へ飛ぶためのアンカー。positionId はスプレッド内で一意。 */
export function anchorIdFor(position: RenderedPosition): string {
  return `at-${position.positionId}`;
}

export function groupPositions(
  reading: RenderedReading,
  resolver: CopyResolver,
): readonly ReadingGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, RenderedPosition[]>();

  for (const position of reading.positions) {
    const key = position.group ?? UNGROUPED;
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      order.push(key);
      buckets.set(key, [position]);
    } else {
      bucket.push(position);
    }
  }

  return order.map((key) => {
    const positions = buckets.get(key) ?? [];
    if (key === UNGROUPED) {
      return { key, isSide: false, positions };
    }
    const copy = resolver.group(`group.${key}`);
    return {
      key,
      label: copy.label,
      note: copy.note,
      isSide: key === "relationship",
      positions,
    };
  });
}

/** 「三枚」など。数を漢字で読ませたいので辞書を引く。 */
export function countLabel(resolver: CopyResolver, n: number): string {
  return resolver.has("ui", `ui.count.${n}`)
    ? resolver.ui(`ui.count.${n}`)
    : `${n}枚`;
}
