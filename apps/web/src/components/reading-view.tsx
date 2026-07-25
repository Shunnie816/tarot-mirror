"use client";

import { getResolver, interpolate } from "@tarot-mirror/content";
import type { RenderedReading } from "@tarot-mirror/engine";
import { useCallback, useRef, useState } from "react";

/**
 * リーディング表示（段階開示）。
 *
 * デザイン（claude design / Reading View）は3枚スプレッド固定で描かれているが、
 * スプレッドは1枚・3枚・8枚があるので枚数に依存しない形に一般化してある。
 * ボタンのラベルは「次に読むものの名前」— 何が開くか分かった上で自分の意志で
 * 開く動作にしたいので、"続きを読む" のような汎用ラベルにしない。
 */
export function ReadingView({ reading }: { readonly reading: RenderedReading }) {
  const resolver = getResolver(reading.locale);
  const total = reading.positions.length;

  const [revealedCount, setRevealedCount] = useState(1);
  const [closingOpen, setClosingOpen] = useState(false);

  /**
   * 開いたブロックへフォーカスを移す。
   * ボタンは押すと消えるので、これをやらないとキーボード操作でフォーカスが
   * body に落ちて、開いた内容まで辿り直しになる。
   */
  const landingRef = useRef<HTMLDivElement | null>(null);
  const focusLanding = useCallback(() => {
    requestAnimationFrame(() => landingRef.current?.focus());
  }, []);

  const revealNext = useCallback(() => {
    setRevealedCount((n) => n + 1);
    focusLanding();
  }, [focusLanding]);

  const revealClosing = useCallback(() => {
    setClosingOpen(true);
    focusLanding();
  }, [focusLanding]);

  const visible = reading.positions.slice(0, revealedCount);
  const next = reading.positions[revealedCount];

  return (
    <div className="reading-page">
      <div className="reading-column">
        <header className="reading-header">
          <div className="reading-eyebrow">{resolver.ui("ui.readingEyebrow")}</div>
          <h1 className="reading-title">{reading.spreadLabel}</h1>
          <div className="reading-rule" />
        </header>

        {reading.question !== undefined && reading.question.length > 0 && (
          <section className="reading-question-block">
            <div className="reading-label">{resolver.ui("ui.questionHeading")}</div>
            <blockquote className="reading-question">
              「{reading.question}」
            </blockquote>
          </section>
        )}

        <div className="reading-positions">
          {visible.map((position, index) => (
            <article
              key={position.positionId}
              className={index === 0 ? "position" : "position revealed"}
              // 直近で開いたブロックだけをフォーカス先にする
              {...(index === revealedCount - 1 && index > 0
                ? { ref: landingRef, tabIndex: -1 }
                : {})}
            >
              <div className="position-head">
                <span className="position-name">{position.positionLabel}</span>
                <span className="position-line" />
              </div>
              <div className="position-card">
                <h2 className="card-name">{position.cardName}</h2>
                <span className="card-orientation">{position.orientationLabel}</span>
              </div>
              <p className="position-text">{position.text}</p>
            </article>
          ))}
        </div>

        {next !== undefined && (
          <button type="button" className="reveal-button" onClick={revealNext}>
            {interpolate(resolver.ui("ui.revealPosition"), {
              position: next.positionLabel,
            })}
          </button>
        )}

        {next === undefined && !closingOpen && (
          <button type="button" className="reveal-button" onClick={revealClosing}>
            {resolver.ui("ui.revealClosing")}
          </button>
        )}

        {closingOpen && (
          <div
            className="closing revealed"
            ref={revealedCount === total ? landingRef : null}
            tabIndex={-1}
          >
            <section className="closing-section closing-section--divided">
              <h2 className="closing-heading">
                {resolver.ui("ui.synthesisHeading")}
              </h2>
              {reading.synthesis.map((text) => (
                <p key={text} className="closing-text">
                  {text}
                </p>
              ))}
            </section>

            <section className="closing-section">
              <h2 className="closing-heading">
                {resolver.ui("ui.reflectionHeading")}
              </h2>
              <ul className="questions-list">
                {reading.closingQuestions.map((question) => (
                  <li key={question} className="question-item">
                    <span aria-hidden="true" className="question-marker">
                      —
                    </span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </section>

            <footer className="closing-note">
              {reading.closingNote.split("。").filter(Boolean).map((sentence) => (
                <p key={sentence}>{sentence}。</p>
              ))}
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
