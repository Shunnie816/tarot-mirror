import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread } from "@tarot-mirror/engine";
import type { ReadingJSON } from "@tarot-mirror/engine";
import { describe, expect, it } from "vitest";

import type { StoredReading } from "@/lib/store/readings";

import { toHistoryEntries, toHistoryEntry } from "./entry";

/**
 * テスト観点
 *
 *  1. 日付・並べ方・引いたカードが1行に揃うこと（Issue #9 の完了条件）
 *  2. 引いた順にカードが並ぶこと
 *  3. 問いは、あるときだけ入ること
 *  4. 同じリーディングに戻れる href になっていること（完了条件）
 *  5. サーバー時刻が未確定でも日付が出ること
 *  6. 知らない並べ方の記録は落ちること
 *  7. 辞書に無いカードがあっても、その1件で画面ごと失わないこと
 *
 * まとめや傾向は作らない。ここで検証しているのは「読んだときのまま並ぶ」こと。
 */

const resolver = getResolver(DEFAULT_LOCALE);

const KEPT_AT = new Date(2026, 6, 26, 9, 30);

function stored(reading: ReadingJSON, createdAt: Date | null = KEPT_AT): StoredReading {
  return { id: `${reading.spreadId}-${reading.seed}`, reading, createdAt };
}

/**
 * 今の版が知らない並べ方で書かれた記録。
 *
 * Firestore から来る値は型検査を通っていないので、この形は実際に起こりうる
 * （スプレッドを増やした版で引き、あとから古い版で開いた場合など）。
 */
function withUnknownSpread(reading: ReadingJSON): ReadingJSON {
  return { ...reading, spreadId: "wheelOfTheYear" } as unknown as ReadingJSON;
}

const threeCards = createReading({
  spread: getSpread("threeCards"),
  deck: riderWaite,
  seed: "history-test",
  question: "いま何を手放すべきか",
});

const oneCard = createReading({
  spread: getSpread("oneCard"),
  deck: riderWaite,
  seed: "history-test",
});

describe("toHistoryEntry", () => {
  it("should show the date, the spread and the cards that were drawn", () => {
    const entry = toHistoryEntry(stored(threeCards), resolver);

    expect(entry?.dateLabel).toBe("2026年7月26日");
    expect(entry?.spreadLabel).toBe(resolver.spread("spread.threeCards"));
    expect(entry?.cardNames).toHaveLength(3);
  });

  it("should keep the cards in the order they were drawn", () => {
    const entry = toHistoryEntry(stored(threeCards), resolver);

    expect(entry?.cardNames).toEqual(
      threeCards.positions.map((position) => resolver.card(position.cardId)),
    );
  });

  it("should carry the question when the reading had one", () => {
    const entry = toHistoryEntry(stored(threeCards), resolver);

    expect(entry?.question).toBe("いま何を手放すべきか");
  });

  it("should leave the question out when the reading had none", () => {
    const entry = toHistoryEntry(stored(oneCard), resolver);

    expect(entry).not.toHaveProperty("question");
  });

  it("should link back to the same reading", () => {
    const entry = toHistoryEntry(stored(threeCards), resolver);

    expect(entry?.href).toContain("spread=threeCards");
    expect(entry?.href).toContain("seed=history-test");
  });

  it("should fall back to when the cards were drawn if the server time is not settled yet", () => {
    const drawnAt = { ...threeCards, meta: { ...threeCards.meta, drawnAt: "2026-01-04T00:00:00.000Z" } };

    const entry = toHistoryEntry(stored(drawnAt, null), resolver);

    expect(entry?.dateLabel).toBe("2026年1月4日");
  });

  it("should drop a record whose spread is no longer known", () => {
    expect(
      toHistoryEntry(stored(withUnknownSpread(threeCards)), resolver),
    ).toBeNull();
  });

  it("should keep the rest of a reading when one card is missing from the dictionary", () => {
    const [first, ...rest] = threeCards.positions;
    const withUnknownCard = {
      ...threeCards,
      positions: [{ ...first!, cardId: "rw.major.99" }, ...rest],
    } as ReadingJSON;

    const entry = toHistoryEntry(stored(withUnknownCard), resolver);

    expect(entry?.cardNames).toHaveLength(2);
  });
});

describe("toHistoryEntries", () => {
  it("should leave out the records it cannot read", () => {
    const entries = toHistoryEntries(
      [stored(threeCards), stored(withUnknownSpread(oneCard))],
      resolver,
    );

    expect(entries).toHaveLength(1);
  });
});
