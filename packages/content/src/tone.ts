/**
 * Tone tokens.
 *
 * Core Principle #1 says a reading is a symbolic interpretation, never a
 * prediction. That is a copy rule, so it belongs in one place that all three
 * text-producing surfaces read from:
 *
 *   1. UI copy (design system)
 *   2. TemplateRenderer  (L4a)
 *   3. The LLM system prompt + its output validator (L4b)
 *
 * Keeping one list means an LLM response can be machine-checked against the
 * exact rule the templates already follow.
 */

/**
 * Sanctioned hedges. Template strings and LLM output should read like these.
 * Exported so the LLM system prompt can quote them rather than paraphrase.
 */
export const SANCTIONED_HEDGES = [
  "〜かもしれません",
  "一つの読み方として",
  "〜と受け取ることもできます",
  "〜について考えてみることもできます",
  "〜を示唆しているのかもしれません",
] as const;

/**
 * Deterministic phrasing that must never appear in a reading.
 *
 * Each entry is a pattern plus the reason, so a validation failure explains
 * itself instead of just rejecting. Patterns are deliberately narrow — we are
 * catching assertions about the future, not banning ordinary Japanese.
 */
export interface BannedPhrase {
  readonly id: string;
  readonly pattern: RegExp;
  readonly reason: string;
  /**
   * Wordings the pattern catches, written out.
   *
   * The LLM system prompt quotes these: a model follows 「必ず」と書かない far
   * better than it follows a regex. They are not documentation — `tone.test.ts`
   * asserts every example still trips its own pattern, so an example cannot
   * drift away from the rule it illustrates.
   */
  readonly examples: readonly string[];
}

export const BANNED_PHRASES: readonly BannedPhrase[] = [
  {
    id: "certainty.kanarazu",
    pattern: /必ず|絶対に|間違いなく/u,
    reason: "断定は予言になる。Tarot Mirror は未来を断定しない。",
    examples: ["必ず", "絶対に", "間違いなく"],
  },
  {
    id: "certainty.futureAssertion",
    pattern: /(でしょう|になります|が訪れます|することになります)。/u,
    reason: "未来の断定形。「〜かもしれません」に置き換える。",
    examples: [
      "〜でしょう。",
      "〜になります。",
      "〜が訪れます。",
      "〜することになります。",
    ],
  },
  {
    id: "certainty.predictionNoun",
    pattern: /予言|運命は|宿命/u,
    reason: "占い師の語彙。AI is an interpreter, not an oracle.",
    examples: ["予言", "運命は", "宿命"],
  },
  {
    id: "fortune.luck",
    pattern: /幸運が|不幸が|凶で|大吉|運勢は/u,
    reason: "吉凶判定。カードは良い/悪いを告げない。",
    examples: ["幸運が", "不幸が", "凶で", "大吉", "運勢は"],
  },
  {
    id: "certainty.guarantee",
    pattern: /保証します|約束します/u,
    reason: "結果の保証は self-reflection の枠を超える。",
    examples: ["保証します", "約束します"],
  },
] as const;

export interface ToneViolation {
  readonly id: string;
  readonly reason: string;
  readonly match: string;
}

/**
 * Scan rendered text for deterministic phrasing.
 *
 * Used by the LLM renderer to decide whether to retry or fall back to the
 * template renderer, and by tests to hold template copy to the same bar.
 */
export function findToneViolations(text: string): ToneViolation[] {
  const violations: ToneViolation[] = [];
  for (const phrase of BANNED_PHRASES) {
    const found = phrase.pattern.exec(text);
    if (found) {
      violations.push({
        id: phrase.id,
        reason: phrase.reason,
        match: found[0],
      });
    }
  }
  return violations;
}
