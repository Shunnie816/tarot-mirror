import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  generateSeed,
  getSpread,
  renderTemplate,
  SPREADS,
} from "@tarot-mirror/engine";
import type { SpreadId } from "@tarot-mirror/engine";

import { ReadingView } from "@/components/reading-view";

function isSpreadId(value: string): value is SpreadId {
  return Object.hasOwn(SPREADS, value);
}

/**
 * デザイン検証用の入口。
 *
 * ?seed= と ?spread= を受けるのは、実際に出てくる可変長のテキストで組版を
 * 確認したいから。同じ seed なら必ず同じリーディングになるので、崩れを見つけたら
 * その seed をそのまま Issue に貼れる。
 *
 * 質問入力（#3）とスプレッド選択（#4）ができたら、この画面はそちらから
 * 遷移してくる形に置き換わる。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const rawSeed = typeof params["seed"] === "string" ? params["seed"] : undefined;
  const rawSpread =
    typeof params["spread"] === "string" ? params["spread"] : undefined;
  const rawQuestion =
    typeof params["q"] === "string" ? params["q"] : "いまの働き方を続けるかどうか迷っている";

  const spread =
    rawSpread !== undefined && isSpreadId(rawSpread)
      ? getSpread(rawSpread)
      : getSpread("threeCards");

  const reading = createReading({
    spread,
    deck: riderWaite,
    seed: rawSeed ?? generateSeed(),
    ...(rawQuestion.length > 0 ? { question: rawQuestion } : {}),
  });

  return <ReadingView reading={renderTemplate(reading)} />;
}
