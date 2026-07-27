import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";

import { JournalList } from "@/components/journal-list";
import { ScreenExit } from "@/components/screen-exit";

/**
 * 書きとめたもの。
 *
 * カードを引かずに書くこともできる。「書くには引かなければならない」という
 * 順序を作ると、引くことが書くための手続きになる。
 */
export default function Page() {
  const resolver = getResolver(DEFAULT_LOCALE);

  return (
    <div className="screen">
      <main className="screen-narrow">
        <header className="screen-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.journalEyebrow")}
          </span>
          <h1 className="screen-title">{resolver.ui("ui.journalTitle")}</h1>
          <p className="screen-lead">{resolver.ui("ui.journalListLead")}</p>
        </header>

        <JournalList locale={DEFAULT_LOCALE} />

        <ScreenExit locale={DEFAULT_LOCALE} />
      </main>
    </div>
  );
}
