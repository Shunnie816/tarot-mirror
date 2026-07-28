import { describe, expect, it } from "vitest";

import { createResolver, interpolate, MissingCopyError } from "./dictionary";
import { getResolver, ja } from "./index";

describe("interpolate", () => {
  it("should fill a named slot", () => {
    expect(interpolate("{a}と{b}", { a: "静けさ", b: "待つ力" })).toBe(
      "静けさと待つ力",
    );
  });

  it("should leave an unknown slot untouched so it surfaces in tests", () => {
    expect(interpolate("{missing}", {})).toBe("{missing}");
  });
});

describe("CopyResolver", () => {
  const resolver = getResolver("ja");

  it("should resolve a keyword id to Japanese text", () => {
    expect(resolver.keyword("kw.beginning")).toBe("新しい始まり");
  });

  it("should resolve a card id to its Japanese name", () => {
    expect(resolver.card("rw.major.16")).toBe("塔");
  });

  it("should fill the keywords slot when resolving a framing", () => {
    const text = resolver.framing("framing.currentState.upright", {
      keywords: "静けさ",
    });

    expect(text).toBe("いまの状況には、静けさが表れているようです。");
  });

  it("should throw MissingCopyError when an id has no copy", () => {
    expect(() => resolver.keyword("kw.doesNotExist")).toThrow(MissingCopyError);
  });

  it("should report absence without throwing via has()", () => {
    expect(resolver.has("keywords", "kw.beginning")).toBe(true);
    expect(resolver.has("keywords", "kw.doesNotExist")).toBe(false);
  });

  it("should expose the locale it was built from", () => {
    expect(createResolver(ja).locale).toBe("ja");
  });
});
