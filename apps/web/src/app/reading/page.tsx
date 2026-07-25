import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  generateSeed,
  getSpread,
  renderTemplate,
} from "@tarot-mirror/engine";

import { ReadingView } from "@/components/reading-view";
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

  return <ReadingView reading={renderTemplate(reading)} />;
}
