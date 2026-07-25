import type {
  CardId,
  FramingId,
  InsightId,
  KeywordId,
  Locale,
  PositionId,
  QuestionId,
  SpreadLabelId,
  ThemeId,
  UiId,
} from "./ids.js";

/** Copy for a cross-card observation produced by an L2 rule. */
export interface InsightCopy {
  /** Short label for UI chips / summaries. */
  readonly label: string;
  /** The observation itself, written in the app's hedged voice. */
  readonly body: string;
}

/**
 * One locale's full text surface. Every ID the engine can emit must resolve
 * here — `dictionary.test.ts` fails the build if any is missing.
 */
export interface Dictionary {
  readonly locale: Locale;
  readonly cards: Readonly<Record<CardId, string>>;
  readonly keywords: Readonly<Record<KeywordId, string>>;
  readonly themes: Readonly<Record<ThemeId, string>>;
  readonly questions: Readonly<Record<QuestionId, string>>;
  /** Templates containing a `{keywords}` slot. */
  readonly framings: Readonly<Record<FramingId, string>>;
  readonly insights: Readonly<Record<InsightId, InsightCopy>>;
  readonly positions: Readonly<Record<PositionId, string>>;
  readonly spreads: Readonly<Record<SpreadLabelId, string>>;
  readonly ui: Readonly<Record<UiId, string>>;
}

export class MissingCopyError extends Error {
  constructor(kind: string, id: string) {
    super(`Missing ${kind} copy for id "${id}"`);
    this.name = "MissingCopyError";
  }
}

/** Fill `{slot}` placeholders. Unknown slots are left untouched so they surface in tests. */
export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}

/**
 * Typed reader over a Dictionary.
 *
 * Lookups throw rather than silently rendering a raw ID: a missing key is a
 * content bug, and the completeness tests are what stop it reaching a user.
 */
export interface CopyResolver {
  readonly locale: Locale;
  card(id: CardId): string;
  keyword(id: KeywordId): string;
  theme(id: ThemeId): string;
  question(id: QuestionId): string;
  framing(id: FramingId, vars: Readonly<Record<string, string>>): string;
  insight(id: InsightId): InsightCopy;
  position(id: PositionId): string;
  spread(id: SpreadLabelId): string;
  ui(id: UiId): string;
  /** Non-throwing probe, for completeness tests and tooling. */
  has(kind: keyof Omit<Dictionary, "locale">, id: string): boolean;
}

export function createResolver(dictionary: Dictionary): CopyResolver {
  const lookup = <T>(
    table: Readonly<Record<string, T>>,
    kind: string,
    id: string,
  ): T => {
    const value = table[id];
    if (value === undefined) throw new MissingCopyError(kind, id);
    return value;
  };

  return {
    locale: dictionary.locale,
    card: (id) => lookup(dictionary.cards, "card", id),
    keyword: (id) => lookup(dictionary.keywords, "keyword", id),
    theme: (id) => lookup(dictionary.themes, "theme", id),
    question: (id) => lookup(dictionary.questions, "question", id),
    framing: (id, vars) =>
      interpolate(lookup(dictionary.framings, "framing", id), vars),
    insight: (id) => lookup(dictionary.insights, "insight", id),
    position: (id) => lookup(dictionary.positions, "position", id),
    spread: (id) => lookup(dictionary.spreads, "spread", id),
    ui: (id) => lookup(dictionary.ui, "ui", id),
    has: (kind, id) => Object.hasOwn(dictionary[kind], id),
  };
}
