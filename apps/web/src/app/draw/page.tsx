import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread, renderTemplate } from "@tarot-mirror/engine";

import { DrawView } from "@/components/draw-view";
import { PrefetchReading } from "@/components/prefetch-reading";
import { groupPositions } from "@/lib/groups";
import {
  readQuestion,
  readSeed,
  readSpread,
  type RawParams,
} from "@/lib/flow";
import { readReadingPrefs } from "@/lib/prefs/server";

/**
 * ドロー。カードを盤面に置いていく。
 *
 * 引きは seed から決定しているので、この画面は結果を作っていない。ただ順に
 * 見せているだけ。シャッフル演出を入れないのはそのため（「引き当てる」期待を
 * 作ってしまう）。画面上でも「順番はもう決まっています」と明示している。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const resolver = getResolver(DEFAULT_LOCALE);

  const spreadId = readSpread(params);
  const seed = readSeed(params) ?? "preview";
  const question = readQuestion(params);

  // 盤面と読み物は同じ引きでなければならない。設定を片方だけが見ていると、
  // ここに逆位置のカードが並んだあと、本文がすべて正位置になる。
  const { allowReversals, llmEnabled } = await readReadingPrefs();

  const source = createReading({
    spread: getSpread(spreadId),
    deck: riderWaite,
    seed,
    allowReversals,
    ...(question !== undefined ? { question } : {}),
  });
  const reading = renderTemplate(source);

  return (
    <div className="screen">
      <main className="screen-wide">
        <header className="screen-reading-block screen-header">
          <span className="screen-eyebrow">{resolver.ui("ui.drawEyebrow")}</span>
          <h1 className="screen-title">{reading.spreadLabel}</h1>
          <p className="screen-lead">{resolver.ui("ui.drawLead")}</p>
        </header>

        <DrawView
          groups={groupPositions(reading, resolver)}
          locale={DEFAULT_LOCALE}
          spread={spreadId}
          seed={seed}
          {...(question !== undefined ? { question } : {})}
        />

        {/* 置いているあいだに整形を頼んでおく。読み物の手前で待たせないため。
            何も描かないし、失敗しても読み物には何も起きない。 */}
        <PrefetchReading reading={source} enabled={llmEnabled} />
      </main>
    </div>
  );
}
