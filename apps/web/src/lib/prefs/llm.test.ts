import { describe, expect, it } from "vitest";

import {
  LLM_COOKIE,
  LLM_ENABLED_BY_DEFAULT,
  parseLlmPref,
  serializeLlmPref,
} from "./llm";

/**
 * 観点
 *
 * 1. 既定は「整えない」（無料で・速く・必ず読める経路を既定にする）
 * 2. 読めない値でも既定に倒れる（設定が壊れても読み物は読める）
 * 3. 書いた値がそのまま読み戻せる
 */
describe("llm preference", () => {
  it("should default to not calling the model", () => {
    expect(LLM_ENABLED_BY_DEFAULT).toBe(false);
    expect(parseLlmPref(undefined)).toBe(false);
  });

  it("should fall back to the default for a value it cannot read", () => {
    expect(parseLlmPref("yes")).toBe(LLM_ENABLED_BY_DEFAULT);
    expect(parseLlmPref("")).toBe(LLM_ENABLED_BY_DEFAULT);
  });

  it("should read back what it wrote", () => {
    for (const enabled of [true, false]) {
      const value = serializeLlmPref(enabled).split(";")[0]?.split("=")[1];

      expect(parseLlmPref(value)).toBe(enabled);
    }
  });

  it("should write a cookie the whole site can read", () => {
    const cookie = serializeLlmPref(true);

    expect(cookie.startsWith(`${LLM_COOKIE}=`)).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("samesite=lax");
  });
});
