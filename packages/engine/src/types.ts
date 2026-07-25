import type {
  CardId,
  FramingId,
  InsightId,
  KeywordId,
  PositionId,
  QuestionId,
  SpreadLabelId,
} from "@tarot-mirror/content";
import type { AxisVector } from "@tarot-mirror/decks";

export type Orientation = "upright" | "reversed";

/**
 * How a card should be read in a given slot.
 *
 * The same card means something different as `origin` than as `advice`. The
 * lens is what carries that difference — and, like everything else here, it
 * resolves to a copy key (`framing.<lens>.<orientation>`) rather than prose.
 */
export type PositionLens =
  | "origin"
  | "currentState"
  | "trajectory"
  | "advice"
  | "catalyst"
  | "theme";

export type PositionGroup = "self" | "partner" | "relationship";

export interface SpreadPosition {
  readonly id: PositionId;
  readonly lens: PositionLens;
  /** Used by relationship rules to compare one side against the other. */
  readonly group?: PositionGroup;
}

export type SpreadId = "oneCard" | "threeCards" | "relationship8";

export interface Spread {
  readonly id: SpreadId;
  readonly labelId: SpreadLabelId;
  readonly positions: readonly SpreadPosition[];
  /**
   * Slots an oracle deck can fill. Declared now so the spread engine already
   * supports "optional Oracle positions" while the MVP ships tarot only.
   */
  readonly oraclePositions: readonly SpreadPosition[];
}

export interface DrawnCard {
  readonly positionId: PositionId;
  readonly cardId: CardId;
  readonly orientation: Orientation;
}

/** L1 output: one card, read through one position. */
export interface PositionReading {
  readonly positionId: PositionId;
  readonly cardId: CardId;
  readonly orientation: Orientation;
  readonly lens: PositionLens;
  readonly group?: PositionGroup;
  /** Up to three, emphasis ordered by lens. */
  readonly keywords: readonly KeywordId[];
  readonly framing: FramingId;
  /** Post-reversal axes — what the L2 rules actually compute over. */
  readonly axes: AxisVector;
}

/** L2 output: an observation about the spread as a whole. */
export interface Insight {
  readonly id: InsightId;
  /** Position ids (or card ids) the observation is grounded in. */
  readonly subjects: readonly string[];
  /** 0..1 — how strongly the condition held. Combined with rule weight for ranking. */
  readonly strength: number;
}

/**
 * L3 output — the complete, language-independent reading.
 *
 * This is the entire contract handed to a renderer. Note there is no prose in
 * it anywhere: that is what keeps the LLM's job bounded and the token cost flat.
 */
export interface ReadingJSON {
  readonly version: 1;
  /** Reproduces the exact draw. Enables replay, testing, and LLM-failure recovery. */
  readonly seed: string;
  readonly spreadId: SpreadId;
  /** The user's own words — the only free text in the structure. */
  readonly question?: string;
  readonly positions: readonly PositionReading[];
  readonly insights: readonly Insight[];
  readonly reflection: readonly QuestionId[];
  readonly meta: {
    readonly deckIds: readonly string[];
    readonly drawnAt: string;
  };
}
