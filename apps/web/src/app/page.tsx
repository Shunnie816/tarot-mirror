import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";

import Link from "next/link";

import { AccountNotice } from "@/components/account-notice";
import { QuestionForm } from "@/components/question-form";
import { readQuestion, type RawParams } from "@/lib/flow";

/** 質問入力。ReadingJSON のなかで唯一の自由入力。 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const resolver = getResolver(DEFAULT_LOCALE);
  const question = readQuestion(params);

  return (
    <div className="screen">
      <main className="screen-narrow">
        <header className="screen-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.questionEyebrow")}
          </span>
          <h1 className="screen-title">{resolver.ui("ui.questionTitle")}</h1>
          <p className="screen-lead">{resolver.ui("ui.questionLead")}</p>
        </header>

        <QuestionForm
          locale={DEFAULT_LOCALE}
          {...(question !== undefined ? { initialQuestion: question } : {})}
        />

        {/* 引くことより前に出さない。ふりかえりは、引いたあとの行き先。 */}
        <p className="screen-note screen-links">
          <Link href="/history" className="quiet-link">
            {resolver.ui("ui.historyLink")}
          </Link>
          <Link href="/journal" className="quiet-link">
            {resolver.ui("ui.journalLink")}
          </Link>
        </p>

        <AccountNotice locale={DEFAULT_LOCALE} />
      </main>
    </div>
  );
}
