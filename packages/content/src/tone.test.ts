import { describe, expect, it } from "vitest";

import { ja } from "./index.js";
import { findToneViolations } from "./tone.js";

/**
 * Core Principle #1 — a reading is never a prediction.
 *
 * These tests treat that principle as executable: every string the app can
 * show a user is scanned with the same validator the LLM renderer uses. If
 * someone writes "必ず〜します" into a dictionary, the build fails here rather
 * than shipping a fortune-telling app.
 */
describe("tone rules", () => {
  const everyCopyString = (): Array<[string, string]> => {
    const entries: Array<[string, string]> = [];
    for (const [id, text] of Object.entries(ja.keywords)) entries.push([id, text]);
    for (const [id, text] of Object.entries(ja.themes)) entries.push([id, text]);
    for (const [id, text] of Object.entries(ja.questions)) entries.push([id, text]);
    for (const [id, text] of Object.entries(ja.framings)) entries.push([id, text]);
    for (const [id, copy] of Object.entries(ja.insights)) {
      entries.push([`${id}.label`, copy.label]);
      entries.push([`${id}.body`, copy.body]);
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

  it("should accept a hedged interpretation", () => {
    const violations = findToneViolations(
      "一つの読み方として、いま立ち止まることを示唆しているのかもしれません。",
    );

    expect(violations).toEqual([]);
  });
});
