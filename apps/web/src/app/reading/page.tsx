import { DEFAULT_LOCALE } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  generateSeed,
  getSpread,
  renderTemplate,
} from "@tarot-mirror/engine";

import { JournalEditor } from "@/components/journal-editor";
import { ReadingView } from "@/components/reading-view";
import { SaveReading } from "@/components/save-reading";
import {
  readQuestion,
  readSeed,
  readSpread,
  type RawParams,
} from "@/lib/flow";
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

  const reading = createReading({
    spread: getSpread(readSpread(params)),
    deck: riderWaite,
    seed: readSeed(params) ?? generateSeed(),
    ...(question !== undefined ? { question } : {}),
  });

  // ReadingJSON をそのままクライアントへ渡す。seed から引き直すこともできるが、
  // それにはエンジンとデッキをクライアントバンドルに載せることになり、
  // 「読むだけの人に重さを負わせない」方針と衝突する。
  // 書く場所は段階開示の外に出す。締めのブロックの中に入れると、最後まで
  // 開いた人しか書けなくなり、履歴から戻って書き直すこともできなくなる。
  return (
    <ReadingView
      reading={renderTemplate(reading)}
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
