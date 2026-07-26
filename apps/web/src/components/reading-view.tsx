"use client";

import { getResolver, interpolate } from "@tarot-mirror/content";
import type { RenderedReading } from "@tarot-mirror/engine";
import { useCallback, useMemo, useRef, useState } from "react";

import { Board, scrollToPosition } from "@/components/board";
import { anchorIdFor, countLabel, groupPositions } from "@/lib/groups";

/**
 * リーディング表示。
 *
 * 段階開示の単位は「群」。8枚なら あなた → 相手 → 二人のあいだ の3回で読み終わる。
 * 1枚ずつ開かせると8回になり、意図的に読む行為が単なる作業になる。
 *
 * 盤面と読み物は同じ画面に積むが、幅の制約は共有しない。盤面は横に広がり、
 * 読み物は1カラムのまま。盤面のカードを押すとその本文へ移動する。
 */
export function ReadingView({
  reading,
  settling = false,
  footer,
}: {
  readonly reading: RenderedReading;
  /**
   * 本文がまだ確定していない。盤面と問いは出したまま、読み物だけを伏せる。
   *
   * 読み始めたあとに文章が入れ替わるのは、読む側からすれば故障に見える。
   * 出してから直すくらいなら、出す前に少し待つ。
   */
  readonly settling?: boolean;
  /**
   * 画面のいちばん下に置かれるもの。読み物の一部ではないので段階開示の外に出す。
   * ここに入れたものは、どこまで開いたかに関係なく最初から載っている。
   */
  readonly footer?: React.ReactNode;
}) {
  const resolver = getResolver(reading.locale);
  const groups = useMemo(
    () => groupPositions(reading, resolver),
    [reading, resolver],
  );

  const [openCount, setOpenCount] = useState(1);
  const [closingOpen, setClosingOpen] = useState(false);

  const landingRef = useRef<HTMLElement | null>(null);
  const focusLanding = useCallback(() => {
    requestAnimationFrame(() => landingRef.current?.focus());
  }, []);

  const openGroup = useCallback(
    (index: number) => {
      setOpenCount(index + 1);
      focusLanding();
    },
    [focusLanding],
  );

  const openClosing = useCallback(() => {
    setClosingOpen(true);
    focusLanding();
  }, [focusLanding]);

  // 一枚引きに「カードどうしの重なり」は存在しない。エンジンは常に synthesis を
  // 返す（空にしない方針）ので、見せるかどうかは表示側で決める。
  const hasCrossCardReading = reading.positions.length > 1;
  const allGroupsOpen = openCount >= groups.length;

  return (
    <div className="screen">
      <div className="screen-wide reading-layout">
        <header className="screen-reading-block reading-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.readingEyebrow")}
          </span>
          <h1 className="reading-title">{reading.spreadLabel}</h1>
          <div className="reading-rule" />
        </header>

        {reading.question !== undefined && reading.question.length > 0 && (
          <section className="screen-reading-block reading-question-block">
            <span className="reading-label">
              {resolver.ui("ui.questionHeading")}
            </span>
            <blockquote className="reading-question">
              「{reading.question}」
            </blockquote>
          </section>
        )}

        <section className="board-block">
          <div className="board-block-head">
            <span className="screen-eyebrow">
              {resolver.ui("ui.boardHeading")}
            </span>
            <span className="screen-note">{resolver.ui("ui.boardHint")}</span>
          </div>
          <Board
            groups={groups}
            locale={reading.locale}
            onSelect={scrollToPosition}
          />
        </section>

        {settling && (
          <p className="screen-reading-block screen-note reading-settling">
            {resolver.ui("ui.readingSettling")}
          </p>
        )}

        <div
          className="screen-reading-block reading-body"
          hidden={settling}
        >
          {groups.map((group, index) => (
            <div key={group.key} className="reading-group">
              {index < openCount && (
                <section
                  className="reading-group-open revealed"
                  {...(index === openCount - 1 && index > 0
                    ? { ref: landingRef, tabIndex: -1 }
                    : {})}
                >
                  {group.label !== undefined && (
                    <div className="group-head">
                      <h2 className="group-name">{group.label}</h2>
                      <span className="group-note">{group.note}</span>
                    </div>
                  )}
                  {group.positions.map((position) => (
                    <article
                      key={position.positionId}
                      id={anchorIdFor(position)}
                      className="position"
                    >
                      <div className="position-head">
                        <span className="position-name">
                          {position.positionLabel}
                        </span>
                        <span className="position-line" />
                      </div>
                      <div className="position-card">
                        <h3 className="card-name">{position.cardName}</h3>
                        <span className="card-orientation">
                          {position.orientationLabel}
                        </span>
                      </div>
                      <p className="position-text">{position.text}</p>
                    </article>
                  ))}
                </section>
              )}

              {index === openCount && (
                <button
                  type="button"
                  className="button button--outline button--block"
                  onClick={() => openGroup(index)}
                >
                  {group.label !== undefined
                    ? interpolate(resolver.ui("ui.revealGroup"), {
                        group: group.label,
                        count: countLabel(resolver, group.positions.length),
                      })
                    : interpolate(resolver.ui("ui.revealGroupUnnamed"), {
                        count: countLabel(resolver, group.positions.length),
                      })}
                </button>
              )}
            </div>
          ))}

          {allGroupsOpen && !closingOpen && (
            <button
              type="button"
              className="button button--outline button--block"
              onClick={openClosing}
            >
              {hasCrossCardReading
                ? resolver.ui("ui.revealClosing")
                : resolver.ui("ui.revealClosingNote")}
            </button>
          )}

          {closingOpen && (
            <section
              className="closing revealed"
              ref={landingRef}
              tabIndex={-1}
            >
              {hasCrossCardReading && (
                <div className="closing-section closing-section--divided">
                  <h2 className="closing-heading">
                    {resolver.ui("ui.synthesisHeading")}
                  </h2>
                  {reading.synthesis.map((text) => (
                    <p key={text} className="closing-text">
                      {text}
                    </p>
                  ))}
                </div>
              )}

              <div className="closing-section">
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
              </div>

              <footer className="closing-note">
                {reading.closingNote
                  .split("。")
                  .filter(Boolean)
                  .map((sentence) => (
                    <p key={sentence}>{sentence}。</p>
                  ))}
                {/* 誰が書いたのかを黙っておかない。整えたのは言葉だけで、
                    意味を決めたのは引いた時点だ、というのは伝えておきたい。 */}
                {reading.mode === "llm" && (
                  <p className="closing-provenance">
                    {resolver.ui("ui.readingAssisted")}
                  </p>
                )}
              </footer>
            </section>
          )}
        </div>

        {footer}
      </div>
    </div>
  );
}
