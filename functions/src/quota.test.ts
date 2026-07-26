import { describe, expect, it } from "vitest";

import { dayKey, nextUsage } from "./quota.js";

/**
 * 観点
 *
 * 1. 初回は1から数え始める
 * 2. 日が変わったら数え直す
 * 3. 上限に達したら断る（境界そのもの）
 */
describe("nextUsage", () => {
  const LIMIT = 3;

  it("should start counting when there is no record yet", () => {
    expect(nextUsage(null, "2026-07-26", LIMIT)).toEqual({
      day: "2026-07-26",
      count: 1,
    });
  });

  it("should count up within the same day", () => {
    expect(nextUsage({ day: "2026-07-26", count: 1 }, "2026-07-26", LIMIT)).toEqual(
      { day: "2026-07-26", count: 2 },
    );
  });

  it("should start over when the day rolls", () => {
    expect(nextUsage({ day: "2026-07-25", count: 99 }, "2026-07-26", LIMIT)).toEqual(
      { day: "2026-07-26", count: 1 },
    );
  });

  it("should refuse once the allowance is used up", () => {
    expect(nextUsage({ day: "2026-07-26", count: LIMIT }, "2026-07-26", LIMIT)).toBeNull();
  });
});

describe("dayKey", () => {
  it("should key on the UTC date", () => {
    expect(dayKey(new Date("2026-07-26T23:59:59.000Z"))).toBe("2026-07-26");
  });
});
