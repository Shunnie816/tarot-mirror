import { DEFAULT_LOCALE } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  generateSeed,
  getSpread,
  renderTemplate,
} from "@tarot-mirror/engine";

import { ReadingView } from "@/components/reading-view";
import { SaveReading } from "@/components/save-reading";
import {
  readQuestion,
  readSeed,
  readSpread,
  type RawParams,
} from "@/lib/flow";

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
  return (
    <ReadingView
      reading={renderTemplate(reading)}
      footer={<SaveReading reading={reading} locale={DEFAULT_LOCALE} />}
    />
  );
}
