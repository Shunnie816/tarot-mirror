import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  THREE_CARDS,
  type ReadingJSON,
} from "@tarot-mirror/engine";
import { describe, expect, it } from "vitest";

import { renderingKey, type FingerprintInput } from "./cache.js";

/**
 * 観点
 *
 * 1. 同じ引きは同じ鍵（開き直しで当たる）
 * 2. **引き直しで変わるものは鍵に入れない**（drawnAt を混ぜると一度も当たらない）
 * 3. プロンプトに入るものが変われば鍵も変わる
 * 4. モデルに渡らないものは鍵に影響しない
 */

const reading = (seed = "cache", question?: string): ReadingJSON =>
  createReading({
    spread: THREE_CARDS,
    deck: riderWaite,
    seed,
    ...(question !== undefined ? { question } : {}),
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

const base = (override: Partial<FingerprintInput> = {}): FingerprintInput => ({
  reading: reading(),
  locale: "ja",
  promptVersion: 1,
  model: "claude-haiku-4-5",
  ...override,
});

describe("renderingKey", () => {
  it("should give the same key to the same reading", () => {
    expect(renderingKey(base())).toBe(renderingKey(base()));
  });

  /**
   * 履歴から開き直すと同じ seed で引き直される。drawnAt はそのたびに変わるので、
   * 鍵に混ぜた瞬間、キャッシュは一度も当たらなくなる。
   */
  it("should ignore when the reading was drawn", () => {
    const early = reading();
    const late: ReadingJSON = {
      ...early,
      meta: { ...early.meta, drawnAt: "2027-01-01T00:00:00.000Z" },
    };

    expect(renderingKey(base({ reading: late }))).toBe(renderingKey(base()));
  });

  /** axes は L2 ルールが使うだけで、モデルには渡らない。 */
  it("should ignore values the model never sees", () => {
    const source = reading();
    const first = source.positions[0]!;
    const nudged: ReadingJSON = {
      ...source,
      positions: [
        { ...first, axes: { ...first.axes, agency: first.axes.agency + 3 } },
        ...source.positions.slice(1),
      ],
      insights: source.insights.map((i) => ({ ...i, strength: 0.999 })),
    };

    expect(renderingKey(base({ reading: nudged }))).toBe(renderingKey(base()));
  });

  it("should change when the prompt version is raised", () => {
    expect(renderingKey(base({ promptVersion: 2 }))).not.toBe(
      renderingKey(base()),
    );
  });

  it("should change when the model is swapped", () => {
    expect(renderingKey(base({ model: "claude-sonnet-5" }))).not.toBe(
      renderingKey(base()),
    );
  });

  it("should change when the question changes", () => {
    expect(
      renderingKey(base({ reading: reading("cache", "転職するか") })),
    ).not.toBe(renderingKey(base()));
  });

  it("should change when a different draw comes out", () => {
    expect(renderingKey(base({ reading: reading("other") }))).not.toBe(
      renderingKey(base()),
    );
  });
});
