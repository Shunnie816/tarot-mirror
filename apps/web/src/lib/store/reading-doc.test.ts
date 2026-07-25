import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread } from "@tarot-mirror/engine";
import { describe, expect, it } from "vitest";

import {
  fromReadingDoc,
  parseReadingDocId,
  readingDocId,
  toReadingDoc,
} from "./reading-doc";

/**
 * テスト観点
 *
 *  1. 同じリーディングは同じ ID になる（開き直しても履歴が増えない）
 *  2. 別のリーディングは別の ID になる
 *  3. URL 経由の seed でもパス区切りが ID に混ざらない
 *  4. seed が保存されている（リーディングを再生成できる — Issue #8 の完了条件）
 *  5. 保存した形から ReadingJSON が復元できる
 *  6. undefined を保存しない（Firestore が受け付けない）
 *  7. 読めない版は復元せず null を返す
 *  8. 壊れたデータで画面を壊さない
 *
 * 合成データではなく実物のリーディングで検証する。任意項目（question / group）の
 * 有無が保存の形に効くので、エンジンが実際に出すものと同じである必要がある。
 */

const threeCards = createReading({
  spread: getSpread("threeCards"),
  deck: riderWaite,
  seed: "doc-test",
  question: "いま何を手放すべきか",
});

/** 8枚だけが group を持つ。任意項目の有無を両方通すために両方使う。 */
const relationship8 = createReading({
  spread: getSpread("relationship8"),
  deck: riderWaite,
  seed: "doc-test",
});

const noQuestion = createReading({
  spread: getSpread("oneCard"),
  deck: riderWaite,
  seed: "doc-test",
});

/** 保存されるオブジェクトの、あらゆる深さの値を平らに集める。 */
function everyValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(everyValue);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(everyValue);
  }
  return [value];
}

describe("readingDocId", () => {
  it("should give the same id to the same reading", () => {
    const again = createReading({
      spread: getSpread("threeCards"),
      deck: riderWaite,
      seed: "doc-test",
    });

    expect(readingDocId(again)).toBe(readingDocId(threeCards));
  });

  it("should give different ids to readings with different seeds", () => {
    const other = createReading({
      spread: getSpread("threeCards"),
      deck: riderWaite,
      seed: "another-seed",
    });

    expect(readingDocId(other)).not.toBe(readingDocId(threeCards));
  });

  it("should give different ids to the same seed read through different spreads", () => {
    expect(readingDocId(relationship8)).not.toBe(readingDocId(threeCards));
  });

  it("should not put a path separator in the id", () => {
    const id = readingDocId({ spreadId: "oneCard", seed: "a/../b" });

    expect(id).not.toContain("/");
  });
});

describe("parseReadingDocId", () => {
  it("should name the reading its id was built from", () => {
    expect(parseReadingDocId(readingDocId(threeCards))).toEqual({
      spreadId: "threeCards",
      seed: "doc-test",
    });
  });

  it("should recover a seed that contained characters needing escaping", () => {
    const id = readingDocId({ spreadId: "oneCard", seed: "a/b c" });

    expect(parseReadingDocId(id)?.seed).toBe("a/b c");
  });

  it("should refuse an id that names no reading", () => {
    expect(parseReadingDocId("threeCards")).toBeNull();
    expect(parseReadingDocId("threeCards-")).toBeNull();
    expect(parseReadingDocId("-seed")).toBeNull();
  });
});

describe("toReadingDoc", () => {
  it("should keep the seed so the reading can be drawn again", () => {
    expect(toReadingDoc(threeCards)["seed"]).toBe("doc-test");
  });

  it("should not store any undefined value", () => {
    const stored = [
      ...everyValue(toReadingDoc(noQuestion)),
      ...everyValue(toReadingDoc(relationship8)),
    ];

    expect(stored).not.toContain(undefined);
  });

  it("should omit the question entirely when there is none", () => {
    expect(toReadingDoc(noQuestion)).not.toHaveProperty("question");
  });
});

describe("fromReadingDoc", () => {
  it("should restore a reading that was stored", () => {
    expect(fromReadingDoc(toReadingDoc(threeCards))).toEqual(threeCards);
  });

  it("should restore a reading that has no question", () => {
    expect(fromReadingDoc(toReadingDoc(noQuestion))).toEqual(noQuestion);
  });

  it("should restore the sides of a relationship spread", () => {
    expect(fromReadingDoc(toReadingDoc(relationship8))).toEqual(relationship8);
  });

  it("should refuse a version it cannot read", () => {
    const stored = { ...toReadingDoc(threeCards), version: 2 };

    expect(fromReadingDoc(stored)).toBeNull();
  });

  it("should refuse a document with no seed", () => {
    const { seed: _seed, ...withoutSeed } = toReadingDoc(threeCards);

    expect(fromReadingDoc(withoutSeed)).toBeNull();
  });

  it("should refuse something that is not a document at all", () => {
    expect(fromReadingDoc(null)).toBeNull();
    expect(fromReadingDoc("reading")).toBeNull();
  });
});
