import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";

import { HistoryList } from "@/components/history-list";
import { ScreenExit } from "@/components/screen-exit";

/**
 * これまでの読み。
 *
 * 統計も、よく出るカードの集計も出さない。数えた瞬間に「当たり外れ」の
 * 語彙が入り込む。ここは並べておく場所であって、読み解く場所ではない。
 */
export default function Page() {
  const resolver = getResolver(DEFAULT_LOCALE);

  return (
    <div className="screen">
      <main className="screen-narrow">
        <header className="screen-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.historyEyebrow")}
          </span>
          <h1 className="screen-title">{resolver.ui("ui.historyTitle")}</h1>
          <p className="screen-lead">{resolver.ui("ui.historyLead")}</p>
        </header>

        <HistoryList locale={DEFAULT_LOCALE} />

        <ScreenExit locale={DEFAULT_LOCALE} />
      </main>
    </div>
  );
}
