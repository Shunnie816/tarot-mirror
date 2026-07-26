import type { CardId, Locale, PositionId } from "@tarot-mirror/content";

import type { PositionGroup, ReadingJSON } from "../types.js";

/** How the prose was produced. Surfaced so the UI can label an LLM-assisted reading. */
export type RenderMode = "template" | "llm";

export interface RenderedPosition {
  readonly positionId: PositionId;
  /**
   * どのカードか。表示名ではなく ID なのは、画面が絵を引くのに要るのが
   * 名前ではなく同一性だから。名前は訳せるが、絵のファイル名は訳せない。
   */
  readonly cardId: CardId;
  readonly positionLabel: string;
  /**
   * The slot named for the board, where a group heading already carries the
   * side: 「あなた・これまで」 becomes 「これまで」 once it sits under 「あなた」.
   */
  readonly shortLabel: string;
  readonly cardName: string;
  readonly orientationLabel: string;
  /**
   * Which side of the spread this slot belongs to. Carried through from the
   * spread because the synthesis refers to it — 「あなたと相手のカードは…」 is
   * meaningless if the surface cannot show which cards those are.
   */
  readonly group?: PositionGroup;
  /** The interpretation itself. */
  readonly text: string;
}

export interface RenderedReading {
  readonly mode: RenderMode;
  readonly locale: Locale;
  readonly spreadLabel: string;
  readonly question?: string;
  readonly positions: readonly RenderedPosition[];
  /** Cross-card observations, already prose. Empty when no rule fired. */
  readonly synthesis: readonly string[];
  readonly closingQuestions: readonly string[];
  readonly closingNote: string;
}

/**
 * One interface, two implementations.
 *
 * `TemplateRenderer` is synchronous, free and offline; `LlmRenderer` calls a
 * Cloud Function. Everything downstream depends only on this type, so the LLM
 * is genuinely optional rather than load-bearing.
 */
export interface ReadingRenderer {
  render(reading: ReadingJSON, locale: Locale): Promise<RenderedReading>;
}
