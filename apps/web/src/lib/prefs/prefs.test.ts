import { describe, expect, it } from "vitest";

import { readFlag, serializeFlag } from "./cookie";
import { LLM_COOKIE, LLM_ENABLED_BY_DEFAULT, parseLlmPref } from "./llm";
import {
  REVERSALS_COOKIE,
  REVERSALS_ENABLED_BY_DEFAULT,
  parseReversalsPref,
} from "./reversals";

/**
 * 観点
 *
 * 1. それぞれの既定が意図どおり（整形はオフ、逆位置はオン）
 * 2. 読めない値でも既定に倒れる（設定が壊れても読み物は読める）
 * 3. 書いた値がそのまま読み戻せる
 * 4. 設定どうしが同じ Cookie を取り合わない
 */
describe("cookie flags", () => {
  it("should fall back to the given default for a value it cannot read", () => {
    expect(readFlag(undefined, true)).toBe(true);
    expect(readFlag("yes", false)).toBe(false);
    expect(readFlag("", true)).toBe(true);
  });

  it("should read back what it wrote", () => {
    for (const enabled of [true, false]) {
      const value = serializeFlag("tm.x", enabled).split(";")[0]?.split("=")[1];

      expect(readFlag(value, !enabled)).toBe(enabled);
    }
  });

  it("should write a cookie the whole site can read", () => {
    const cookie = serializeFlag("tm.x", true);

    expect(cookie.startsWith("tm.x=")).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("samesite=lax");
  });
});

describe("reading preferences", () => {
  /** 整形はお金がかかる。既定は無料で速い経路。 */
  it("should leave the model switched off until asked", () => {
    expect(LLM_ENABLED_BY_DEFAULT).toBe(false);
    expect(parseLlmPref(undefined)).toBe(false);
    expect(parseLlmPref("1")).toBe(true);
  });

  /** 逆位置は読み方の中心。既定で外すと読み物が平板になる。 */
  it("should keep reversals on until asked to drop them", () => {
    expect(REVERSALS_ENABLED_BY_DEFAULT).toBe(true);
    expect(parseReversalsPref(undefined)).toBe(true);
    expect(parseReversalsPref("0")).toBe(false);
  });

  it("should not let one setting overwrite the other", () => {
    expect(LLM_COOKIE).not.toBe(REVERSALS_COOKIE);
  });
});
