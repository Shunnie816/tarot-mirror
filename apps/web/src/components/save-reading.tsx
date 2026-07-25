"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import type { ReadingJSON } from "@tarot-mirror/engine";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/session/provider";

/**
 * 読んだリーディングを残す。
 *
 * 保存ボタンを置かない。「気に入った引きだけ残す」形にすると履歴が選ばれたものに
 * 偏り、「同じカードが繰り返し出ている」ことに自分で気づけなくなる。気づきの材料に
 * するには、偏りなく揃っている必要がある。
 *
 * ドキュメント ID はリーディングそのものから決まるので、同じ URL を開き直しても
 * 履歴は増えない。決定性がそのまま冪等性になっている。
 *
 * 保存できなかったときは何も言わない。できたことだけを伝える。
 */
export function SaveReading({
  reading,
  locale,
}: {
  readonly reading: ReadingJSON;
  readonly locale: Locale;
}) {
  const session = useSession();
  const [kept, setKept] = useState(false);

  // オブジェクトではなく uid で見る。認証はトークン更新のたびに新しい
  // オブジェクトを流すので、そのまま依存に置くと保存を何度も試みることになる。
  const uid = session.status === "ready" ? (session.user?.uid ?? null) : null;

  useEffect(() => {
    if (uid === null) return;

    let active = true;
    const keep = async () => {
      const [{ getFirebaseDb }, { saveReading }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/store/readings"),
      ]);
      await saveReading(getFirebaseDb(), uid, reading);
      if (active) setKept(true);
    };

    // 残せなかったことを画面に出さない。読むことは続けられる。
    void keep().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [uid, reading]);

  if (!kept) return null;

  return (
    <p className="screen-note reading-kept">
      {getResolver(locale).ui("ui.readingKept")}
    </p>
  );
}
