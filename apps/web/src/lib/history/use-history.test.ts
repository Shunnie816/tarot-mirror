import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread } from "@tarot-mirror/engine";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { StoredReading } from "@/lib/store/readings";

import type { LoadReadings } from "./use-history";
import { useHistory } from "./use-history";

/**
 * テスト観点
 *
 *  1. 認証の返事を待っているあいだは「読み込み中」であること
 *  2. 読み込めたら件数が入ること
 *  3. 保存できない状態では読みにいかないこと
 *  4. 読み込みに失敗しても壊れないこと
 *  5. 遅れて届いた結果を、離れたあとに反映しないこと
 *
 * 「まだ分からない」と「無い」を取り違えないことがここの主題。
 */

const KEPT: readonly StoredReading[] = [
  {
    id: "oneCard-a",
    reading: createReading({
      spread: getSpread("oneCard"),
      deck: riderWaite,
      seed: "a",
    }),
    createdAt: new Date(2026, 6, 26),
  },
];

interface FakeStore {
  readonly load: LoadReadings;
  resolve(readings: readonly StoredReading[]): void;
  reject(): void;
  calls(): number;
}

function createFakeStore(): FakeStore {
  let settle: {
    resolve: (readings: readonly StoredReading[]) => void;
    reject: (reason: Error) => void;
  } | null = null;
  let calls = 0;

  return {
    load: () => {
      calls += 1;
      return new Promise((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
    resolve: (readings) => settle?.resolve(readings),
    reject: () => settle?.reject(new Error("unreachable")),
    calls: () => calls,
  };
}

describe("useHistory", () => {
  afterEach(cleanup);

  it("should wait while the session has not answered yet", () => {
    const store = createFakeStore();

    const { result } = renderHook(() => useHistory(undefined, store.load));

    expect(result.current.status).toBe("loading");
    expect(store.calls()).toBe(0);
  });

  it("should report what was kept once it is loaded", async () => {
    const store = createFakeStore();
    const { result } = renderHook(() => useHistory("uid-1", store.load));

    await act(async () => {
      store.resolve(KEPT);
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.readings).toHaveLength(1);
  });

  it("should not go looking when nothing can be saved", () => {
    const store = createFakeStore();

    const { result } = renderHook(() => useHistory(null, store.load));

    expect(result.current.status).toBe("unavailable");
    expect(store.calls()).toBe(0);
  });

  it("should stay usable when the readings cannot be loaded", async () => {
    const store = createFakeStore();
    const { result } = renderHook(() => useHistory("uid-1", store.load));

    await act(async () => {
      store.reject();
    });

    expect(result.current.status).toBe("unavailable");
  });

  it("should ignore readings that arrive after the screen is gone", async () => {
    const store = createFakeStore();
    const { result, unmount } = renderHook(() => useHistory("uid-1", store.load));

    unmount();
    await act(async () => {
      store.resolve(KEPT);
    });

    expect(result.current.readings).toHaveLength(0);
  });
});
