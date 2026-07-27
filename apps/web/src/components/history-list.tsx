"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import Link from "next/link";
import { useMemo } from "react";

import { toHistoryEntries } from "@/lib/history/entry";
import type { LoadReadings } from "@/lib/history/use-history";
import { useHistory } from "@/lib/history/use-history";
import { useSession } from "@/lib/session/provider";

/**
 * これまでの読みを並べる。
 *
 * 並べるだけで、まとめない。同じカードに何度も会っていることに気づくのは
 * 利用者の仕事で、こちらから「あなたはこういう傾向です」と言わない。
 * 言った瞬間、このアプリは鏡ではなく占い師になる。
 *
 * 開くと `/reading` に戻る。seed が同じなら同じリーディングが再現されるので、
 * 保存した本文を持ち回らなくても読み直せる。
 */

/** モジュール直下に置いて識別子を安定させる（毎レンダー作り直すと読み込みが繰り返される）。 */
const load: LoadReadings = async (uid) => {
  const [{ getFirebaseDb }, { listReadings }] = await Promise.all([
    import("@/lib/firebase/client"),
    import("@/lib/store/readings"),
  ]);
  return listReadings(getFirebaseDb(), uid);
};

export function HistoryList({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();

  // 認証の状態を、そのまま履歴の3つの状態に写す。
  const uid =
    session.status === "connecting"
      ? undefined
      : (session.user?.uid ?? null);

  const { status, readings } = useHistory(uid, load);
  const entries = useMemo(
    () => toHistoryEntries(readings, resolver),
    [readings, resolver],
  );

  if (status === "loading") {
    return <p className="screen-note">{resolver.ui("ui.historyLoading")}</p>;
  }

  if (status === "unavailable") {
    return (
      <p className="screen-note">{resolver.ui("ui.historyUnavailable")}</p>
    );
  }

  if (status === "failed") {
    return <p className="screen-note">{resolver.ui("ui.historyFailed")}</p>;
  }

  if (entries.length === 0) {
    return <p className="screen-lead">{resolver.ui("ui.historyEmpty")}</p>;
  }

  return (
    <ul className="history-list">
      {entries.map((entry) => (
        <li key={entry.id} className="history-entry">
          <Link href={entry.href} className="history-entry-link">
            <span className="history-entry-head">
              {entry.dateLabel !== undefined && (
                <span className="history-entry-date">{entry.dateLabel}</span>
              )}
              <span className="history-entry-spread">{entry.spreadLabel}</span>
            </span>

            {entry.question !== undefined && (
              <span className="history-entry-question">
                「{entry.question}」
              </span>
            )}

            <span className="history-entry-cards">
              {entry.cardNames.join(resolver.ui("ui.cardSeparator"))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
