import { describe, expect, it } from "vitest";

import { ja } from "./index";
import { promptTables } from "./prompt";
import { BANNED_PHRASES, findToneViolations } from "./tone";

/**
 * Core Principle #1 — a reading is never a prediction.
 *
 * These tests treat that principle as executable: every string the app can
 * show a user is scanned with the same validator the LLM renderer uses. If
 * someone writes "必ず〜します" into a dictionary, the build fails here rather
 * than shipping a fortune-telling app.
 */
describe("tone rules", () => {
  /**
   * Every table, not just the ones a reading is assembled from. Screen copy is
   * read by the same person in the same sitting, so a prediction smuggled into
   * a button label counts exactly as much as one in an interpretation.
   */
  const everyCopyString = (): Array<[string, string]> => {
    const entries: Array<[string, string]> = [];
    const flat = {
      cards: ja.cards,
      keywords: ja.keywords,
      themes: ja.themes,
      questions: ja.questions,
      framings: ja.framings,
      positions: ja.positions,
      positionsShort: ja.positionsShort,
      spreads: ja.spreads,
      spreadNotes: ja.spreadNotes,
      ui: ja.ui,
      // プロンプトも読み物と同じ規律で書く。辞書の外（`content/prompt`）に
      // 出してあるのはバンドルの都合だけで、トーンの扱いは同じ。
      // 禁止表現の例文は tone.ts 側（コード）にあるので、辞書はここを通せる。
      // ここが落ちたら、例文を prompt.json に書こうとしている。
      prompt: promptTables.ja,
    };
    for (const [table, record] of Object.entries(flat)) {
      for (const [id, text] of Object.entries(record)) {
        entries.push([`${table}/${id}`, text]);
      }
    }
    for (const [id, copy] of Object.entries(ja.insights)) {
      entries.push([`insights/${id}.label`, copy.label]);
      entries.push([`insights/${id}.body`, copy.body]);
    }
    for (const [id, copy] of Object.entries(ja.groups)) {
      entries.push([`groups/${id}.label`, copy.label]);
      entries.push([`groups/${id}.note`, copy.note]);
    }
    return entries;
  };

  it("should report no violations for any string in the ja dictionary", () => {
    const offenders = everyCopyString()
      .map(([id, text]) => ({ id, violations: findToneViolations(text) }))
      .filter((entry) => entry.violations.length > 0);

    expect(offenders).toEqual([]);
  });

  it("should flag an assertion of certainty", () => {
    const violations = findToneViolations("あなたは必ず前に進めます。");

    expect(violations).toHaveLength(1);
    expect(violations[0]?.id).toBe("certainty.kanarazu");
  });

  it("should flag a deterministic statement about the future", () => {
    const violations = findToneViolations("来月、新しい出会いが訪れます。");

    expect(violations.map((v) => v.id)).toContain("certainty.futureAssertion");
  });

  it("should flag fortune-telling vocabulary", () => {
    const violations = findToneViolations("今週の運勢は大吉です。");

    expect(violations.map((v) => v.id)).toContain("fortune.luck");
  });

  /**
   * The system prompt quotes `examples` instead of the regexes, so an example
   * that no longer matches its rule would quietly teach the model to avoid
   * something we do not actually check.
   */
  it("should flag every wording listed as an example of its own rule", () => {
    const drifted = BANNED_PHRASES.flatMap((phrase) =>
      phrase.examples
        .filter(
          (example) =>
            !findToneViolations(example).some((v) => v.id === phrase.id),
        )
        .map((example) => `${phrase.id}: ${example}`),
    );

    expect(drifted).toEqual([]);
  });

  it("should accept a hedged interpretation", () => {
    const violations = findToneViolations(
      "一つの読み方として、いま立ち止まることを示唆しているのかもしれません。",
    );

    expect(violations).toEqual([]);
  });
});
