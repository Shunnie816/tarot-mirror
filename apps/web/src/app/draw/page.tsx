import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread, renderTemplate } from "@tarot-mirror/engine";

import { DrawView } from "@/components/draw-view";
import { groupPositions } from "@/lib/groups";
import {
  readQuestion,
  readSeed,
  readSpread,
  type RawParams,
} from "@/lib/flow";

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

  const reading = renderTemplate(
    createReading({
      spread: getSpread(spreadId),
      deck: riderWaite,
      seed,
      ...(question !== undefined ? { question } : {}),
    }),
  );

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
      </main>
    </div>
  );
}
