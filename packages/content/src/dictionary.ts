import type {
  CardId,
  FramingId,
  GroupId,
  InsightId,
  KeywordId,
  Locale,
  PositionId,
  PromptId,
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

/** Copy for a side of a spread that is laid out and read as a unit. */
export interface GroupCopy {
  /** Names the side, e.g. 「あなた」. */
  readonly label: string;
  /** One line explaining where the side sits on the board and why. */
  readonly note: string;
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
  /**
   * The same slot named for the board, where the group heading already carries
   * the side: 「あなた・これまで」 becomes 「これまで」 once it sits under 「あなた」.
   */
  readonly positionsShort: Readonly<Record<PositionId, string>>;
  readonly spreads: Readonly<Record<SpreadLabelId, string>>;
  /** What choosing this spread means — shown when picking, not while reading. */
  readonly spreadNotes: Readonly<Record<SpreadLabelId, string>>;
  readonly groups: Readonly<Record<GroupId, GroupCopy>>;
  readonly ui: Readonly<Record<UiId, string>>;
  /**
   * The instructions handed to the LLM renderer.
   *
   * Prompt text is copy like any other, so it lives beside the copy it governs
   * rather than inside the renderer. Keeping it here is also what lets a second
   * locale change what the model is told without touching the engine.
   */
  readonly prompt: Readonly<Record<PromptId, string>>;
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
  positionShort(id: PositionId): string;
  spread(id: SpreadLabelId): string;
  spreadNote(id: SpreadLabelId): string;
  group(id: GroupId): GroupCopy;
  ui(id: UiId): string;
  prompt(id: PromptId): string;
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
    positionShort: (id) => lookup(dictionary.positionsShort, "positionShort", id),
    spread: (id) => lookup(dictionary.spreads, "spread", id),
    spreadNote: (id) => lookup(dictionary.spreadNotes, "spreadNote", id),
    group: (id) => lookup(dictionary.groups, "group", id),
    ui: (id) => lookup(dictionary.ui, "ui", id),
    prompt: (id) => lookup(dictionary.prompt, "prompt", id),
    has: (kind, id) => Object.hasOwn(dictionary[kind], id),
  };
}
