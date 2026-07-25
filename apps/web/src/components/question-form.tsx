"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildHref } from "@/lib/flow";

/**
 * 問いを書く。書かなくても進める。
 *
 * 「問いを書かずに進む」を同じ大きさで横に並べているのは、これをスキップリンクに
 * すると「書かないのは手抜き」という含みが出るため。どちらも等しく正しい進み方。
 * 文字数カウンタも置かない（書く量を評価しているように見える）。
 */
export function QuestionForm({
  locale,
  initialQuestion = "",
}: {
  readonly locale: Locale;
  readonly initialQuestion?: string;
}) {
  const resolver = getResolver(locale);
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);

  const proceed = (withQuestion: boolean) => {
    router.push(
      buildHref("/spread", withQuestion ? { question: question.trim() } : {}),
    );
  };

  return (
    <>
      <div className="field-block">
        <label className="field-label" htmlFor="question">
          {resolver.ui("ui.questionFieldLabel")}
        </label>
        <textarea
          id="question"
          className="field"
          rows={4}
          value={question}
          placeholder={resolver.ui("ui.questionPlaceholder")}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <span className="screen-note">{resolver.ui("ui.questionNote")}</span>
      </div>

      <div className="actions">
        <button
          type="button"
          className="button button--solid button--half"
          onClick={() => proceed(true)}
        >
          {resolver.ui("ui.questionSubmit")}
        </button>
        <button
          type="button"
          className="button button--outline button--half"
          onClick={() => proceed(false)}
        >
          {resolver.ui("ui.questionSkip")}
        </button>
      </div>
    </>
  );
}
