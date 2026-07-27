"use client";

import { useEffect, useState } from "react";

import { reportStoreFailure } from "@/lib/store/report";
import type { StoredReading } from "@/lib/store/readings";

export type LoadReadings = (uid: string) => Promise<readonly StoredReading[]>;

export type HistoryStatus = "loading" | "ready" | "unavailable" | "failed";

/**
 * 履歴の読み込み。
 *
 * `uid` の3つの値がそのまま3つの状態になる。
 *   undefined … 認証の返事待ち。まだ何とも言えない
 *   null      … 保存できない状態。並ぶものが原理的に無い
 *   string    … 読む
 *
 * 「まだ分からない」と「無い」を同じ扱いにすると、開いた瞬間に一瞬だけ
 * 「何も残っていません」と出てから消える。事実としても体験としても正しくない。
 *
 * 読みにいって失敗した場合は4つ目の `failed` になる。`unavailable` と混ぜない。
 * 前者は「もう一度ひらけば読めるかもしれない」、後者は「原理的に並ぶものが無い」で、
 * 利用者が次にできることが違う。混ぜていたせいで、本番のルール未反映
 * （Issue #52）が「保存は未実装」に見えていた。
 */
export function useHistory(
  uid: string | null | undefined,
  load: LoadReadings,
): { readonly status: HistoryStatus; readonly readings: readonly StoredReading[] } {
  const [status, setStatus] = useState<HistoryStatus>("loading");
  const [readings, setReadings] = useState<readonly StoredReading[]>([]);

  useEffect(() => {
    if (uid === undefined) {
      setStatus("loading");
      return;
    }
    if (uid === null) {
      setStatus("unavailable");
      return;
    }

    let active = true;
    setStatus("loading");

    load(uid)
      .then((list) => {
        if (!active) return;
        setReadings(list);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        // 読めなかったことを画面に出しはするが、エラーにはしない。
        reportStoreFailure("これまでの読みを読み込めなかった", error);
        if (active) setStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [uid, load]);

  return { status, readings };
}
