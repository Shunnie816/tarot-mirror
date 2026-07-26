"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import type { RenderedPosition } from "@tarot-mirror/engine";

import { anchorIdFor, type ReadingGroup } from "@/lib/groups";

/**
 * 盤面 — 実際にカードを並べたときの配置。
 *
 * 8枚なら上段が「あなた」、下段が「相手」で上下が鏡、右脇に「二人のあいだ」。
 * 本文は「あなたと相手のカードは…」と空間を指すので、配置が見えないと
 * 存在しないものを参照していることになる。盤面は装飾ではなく読み取りの前提。
 *
 * 幅は --measure-board。読み物の行長（--measure-reading）には従わない。
 * カードごとに本文を横に並べる案は採っていない（全角38字 × 3 は読めない幅になる）。
 */
/** 原寸そのままの比。枠だけ先に取っておかないと、読み込みのたびに盤面が跳ねる。 */
const ART_WIDTH = 320;
const ART_HEIGHT = 548;

/**
 * カードの絵。
 *
 * `alt` は空にする。カード名はすぐ下に文字で並んでいるので、絵に名前を
 * 持たせると読み上げが二重になる。ボタンの読み上げ名は文字のほうが担っている。
 *
 * 逆位置は絵ごと180°回す。文字を回すと読めなくなるので採らなかった判断
 * （DECISIONS-round2）は、回すものが絵になったことで前提が変わった。
 * 罫線での表示は残す。読み込みの前や失敗したときに向きが分かる唯一の手がかりで、
 * 盤面を引きで見たときに逆位置の分布が見えるのはこちらの効き目。
 */
function CardArt({
  cardId,
  reversed,
}: {
  /** 未指定なら伏せた状態。 */
  readonly cardId?: string;
  readonly reversed: boolean;
}) {
  return (
    <img
      className={reversed ? "tile-art tile-art--reversed" : "tile-art"}
      src={`/cards/${cardId ?? "back"}.webp`}
      alt=""
      width={ART_WIDTH}
      height={ART_HEIGHT}
      loading="lazy"
      decoding="async"
      draggable={false}
      // 絵が来なくても読めることは変えない。出せないなら黙って引っ込める。
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

export function Board({
  groups,
  locale,
  placedCount,
  staggerGroupIndex,
  onSelect,
}: {
  readonly groups: readonly ReadingGroup[];
  readonly locale: Locale;
  /** ここまでの群だけ表向き。省略時はすべて表向き。 */
  readonly placedCount?: number;
  /** この群だけ1枚ずつずらして置く（ドロー中の直近の組）。 */
  readonly staggerGroupIndex?: number;
  readonly onSelect?: (position: RenderedPosition) => void;
}) {
  const resolver = getResolver(locale);
  const placed = placedCount ?? groups.length;

  const main = groups.filter((g) => !g.isSide);
  const side = groups.find((g) => g.isSide);

  const renderTile = (
    position: RenderedPosition,
    group: ReadingGroup,
    groupIndex: number,
    tileIndex: number,
  ) => {
    const isPlaced = groupIndex < placed;
    const delay =
      staggerGroupIndex === groupIndex
        ? `calc(var(--motion-stagger) * ${tileIndex})`
        : "0ms";
    const reversed =
      isPlaced && position.orientationLabel === resolver.ui("ui.reversed");

    return (
      <button
        key={position.positionId}
        type="button"
        className={group.isSide ? "tile tile--side" : "tile"}
        style={{ animationDelay: delay }}
        disabled={!isPlaced || onSelect === undefined}
        {...(isPlaced && onSelect !== undefined
          ? { onClick: () => onSelect(position) }
          : {})}
      >
        {reversed && <span className="tile-edge tile-edge--top" />}
        <span className="tile-position">{position.shortLabel}</span>
        <CardArt
          {...(isPlaced ? { cardId: position.cardId } : {})}
          reversed={reversed}
        />
        {isPlaced ? (
          <>
            <span className="tile-name">{position.cardName}</span>
            <span className="tile-orientation">{position.orientationLabel}</span>
          </>
        ) : (
          <span className="tile-name tile-name--empty">
            {resolver.ui("ui.boardNotYet")}
          </span>
        )}
        {isPlaced && !reversed && (
          <span className="tile-edge tile-edge--bottom" />
        )}
      </button>
    );
  };

  return (
    <div className="board">
      <div className="board-main">
        {main.map((group, groupIndex) => (
          <div key={group.key} className="board-group">
            {group.label !== undefined && (
              <div className="board-group-head">
                <span className="board-group-name">{group.label}</span>
                <span className="board-group-line" />
              </div>
            )}
            <div className="board-row">
              {group.positions.map((position, tileIndex) =>
                renderTile(position, group, groups.indexOf(group), tileIndex),
              )}
            </div>
            {/* 上下が鏡であることを明示する。8枚の意味はこの対比にある。 */}
            {main.length === 2 && groupIndex === 0 && (
              <div className="board-mirror">
                <span className="board-mirror-line" />
                <span className="board-mirror-label">
                  {resolver.ui("ui.boardMirror")}
                </span>
                <span className="board-mirror-line" />
              </div>
            )}
          </div>
        ))}
      </div>

      {side !== undefined && (
        <div className="board-side">
          <div className="board-group-head">
            <span className="board-group-name board-group-name--side">
              {side.label}
            </span>
            <span className="board-group-line" />
          </div>
          <div className="board-row board-row--side">
            {side.positions.map((position, tileIndex) =>
              renderTile(position, side, groups.indexOf(side), tileIndex),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 盤面のカードから本文へ移動する。 */
export function scrollToPosition(position: RenderedPosition): void {
  const element = document.getElementById(anchorIdFor(position));
  if (element === null) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  element.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}
