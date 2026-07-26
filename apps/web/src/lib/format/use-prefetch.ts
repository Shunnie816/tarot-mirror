"use client";

import type { ReadingJSON } from "@tarot-mirror/engine";
import { useEffect, useRef } from "react";

/**
 * 整形を先に頼んでおく。
 *
 * 頼むこと自体は一行だが、**頼みすぎないこと**に意味がある。1回ごとにお金が
 * かかるので、同じ引きに二度投げてはいけない。認証はトークンを更新するたびに
 * 新しいセッションを流すため、素直に effect を書くと、カードを置いている
 * 数十秒のあいだに何度も投げてしまう。
 *
 * 結果は受け取らない。サーバー側のキャッシュに載ることだけが目的で、
 * 失敗しても遅れても、読み物はテンプレートで完成する。
 */
export type AskToFormat = (reading: ReadingJSON) => Promise<unknown>;

export interface PrefetchOptions {
  /** 設定がオフなら投げない。使わないものに払う理由が無い。 */
  readonly enabled: boolean;
  /** サインインが済むまでは呼べない。`null` は「まだ / 使えない」。 */
  readonly uid: string | null;
}

export function usePrefetchFormatting(
  reading: ReadingJSON,
  ask: AskToFormat,
  { enabled, uid }: PrefetchOptions,
): void {
  // 引きが同じなら中身も同じ。頼んだかどうかは引きで覚える。
  const key = `${reading.spreadId}:${reading.seed}`;
  const asked = useRef<string | null>(null);
  const latest = useRef({ reading, ask });
  latest.current = { reading, ask };

  useEffect(() => {
    if (!enabled || uid === null) return;
    if (asked.current === key) return;
    asked.current = key;

    const { reading: source, ask: request } = latest.current;
    // 返事は見ない。ここでの失敗は、読み物の側で起きることを何も変えない。
    void request(source).catch(() => undefined);
  }, [enabled, uid, key]);
}
