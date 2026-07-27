import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { ALL_SPREADS, createReading, renderTemplate } from "@tarot-mirror/engine";

import { Board } from "@/components/board";
import { ScreenExit } from "@/components/screen-exit";
import { SpreadPicker } from "@/components/spread-picker";
import { groupPositions } from "@/lib/groups";
import { readQuestion, type RawParams } from "@/lib/flow";

/**
 * スプレッド選択。盤面の形そのものを選択肢にしている。
 *
 * 枚数はラベルに出さない。多いほうがよく分かるということはなく、
 * 枚数の多さを「豪華さ」として売ると上位プランに見えてしまう。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const resolver = getResolver(DEFAULT_LOCALE);
  const question = readQuestion(params);

  // 伏せたままの盤面を出すだけなので seed は何でもよい。
  // カードは一枚も表にならない。
  const previews = ALL_SPREADS.map((spread) => {
    const rendered = renderTemplate(
      createReading({ spread, deck: riderWaite, seed: "preview" }),
    );
    return {
      id: spread.id,
      label: rendered.spreadLabel,
      note: resolver.spreadNote(spread.labelId),
      groups: groupPositions(rendered, resolver),
    };
  });

  return (
    <div className="screen">
      <main className="screen-wide">
        <header className="screen-reading-block screen-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.spreadEyebrow")}
          </span>
          <h1 className="screen-title">{resolver.ui("ui.spreadTitle")}</h1>
          <p className="screen-lead">{resolver.ui("ui.spreadLead")}</p>
        </header>

        <div className="spread-list">
          {previews.map((preview) => (
            <section key={preview.id} className="spread-option">
              <div className="screen-reading-block">
                <h2 className="spread-option-name">{preview.label}</h2>
                <p className="screen-lead">{preview.note}</p>
              </div>
              <Board
                groups={preview.groups}
                locale={DEFAULT_LOCALE}
                placedCount={0}
              />
              <SpreadPicker
                locale={DEFAULT_LOCALE}
                spread={preview.id}
                {...(question !== undefined ? { question } : {})}
              />
            </section>
          ))}
        </div>

        <ScreenExit locale={DEFAULT_LOCALE} reading />
      </main>
    </div>
  );
}
