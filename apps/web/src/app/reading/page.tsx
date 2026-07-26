import { DEFAULT_LOCALE } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  generateSeed,
  getSpread,
  renderTemplate,
} from "@tarot-mirror/engine";
import { cookies } from "next/headers";

import { JournalEditor } from "@/components/journal-editor";
import { ReadingSurface } from "@/components/reading-surface";
import { SaveReading } from "@/components/save-reading";
import {
  readQuestion,
  readSeed,
  readSpread,
  type RawParams,
} from "@/lib/flow";
import { LLM_COOKIE, parseLlmPref } from "@/lib/prefs/llm";
import { readingDocId } from "@/lib/store/reading-doc";

/**
 * リーディング表示。
 *
 * 状態はすべて URL にあるので、この URL を開き直せば同じリーディングが再現される。
 * 崩れを見つけたら URL をそのまま Issue に貼れる。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const question = readQuestion(params);

  // 整形するかどうかは最初の描画そのものを変えるので、サーバーで知っておく。
  // クライアントで読むと、既定の無料経路にまで「待っている」画面が挟まるか、
  // 整える経路で本文が一瞬出てから消えるかのどちらかになる。
  const llmEnabled = parseLlmPref((await cookies()).get(LLM_COOKIE)?.value);

  const reading = createReading({
    spread: getSpread(readSpread(params)),
    deck: riderWaite,
    seed: readSeed(params) ?? generateSeed(),
    ...(question !== undefined ? { question } : {}),
  });

  // ReadingJSON をそのままクライアントへ渡す。seed から引き直すこともできるが、
  // それにはエンジンとデッキをクライアントバンドルに載せることになり、
  // 「読むだけの人に重さを負わせない」方針と衝突する。
  //
  // 辞書だけで組んだ読み物はサーバーで作り、そのまま渡す。整形が要らない
  // 設定でも、届かなくても、これがそのまま画面に出る。LLM は上乗せであって、
  // 読めるかどうかを左右しない。
  //
  // 書く場所は段階開示の外に出す。締めのブロックの中に入れると、最後まで
  // 開いた人しか書けなくなり、履歴から戻って書き直すこともできなくなる。
  return (
    <ReadingSurface
      source={reading}
      template={renderTemplate(reading)}
      llmEnabled={llmEnabled}
      footer={
        <>
          <JournalEditor
            readingId={readingDocId(reading)}
            locale={DEFAULT_LOCALE}
          />
          <SaveReading reading={reading} locale={DEFAULT_LOCALE} />
        </>
      }
    />
  );
}
