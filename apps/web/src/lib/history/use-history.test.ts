import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread } from "@tarot-mirror/engine";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoredReading } from "@/lib/store/readings";

import type { LoadReadings } from "./use-history";
import { useHistory } from "./use-history";

/**
 * テスト観点
 *
 *  1. 認証の返事を待っているあいだは「読み込み中」であること
 *  2. 読み込めたら件数が入ること
 *  3. 保存できない状態では読みにいかないこと
 *  4. 読み込みに失敗したとき、「保存できない状態」と区別されること
 *  5. 読み込みに失敗した理由が握りつぶされないこと
 *  6. 遅れて届いた結果を、離れたあとに反映しないこと
 *
 * 「まだ分からない」と「無い」と「読めなかった」を取り違えないことがここの主題。
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
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it("should say it could not load, not that nothing can be saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createFakeStore();
    const { result } = renderHook(() => useHistory("uid-1", store.load));

    await act(async () => {
      store.reject();
    });

    expect(result.current.status).toBe("failed");
  });

  // 本番のルールが未反映で毎回 403 が返っていたとき、理由がどこにも
  // 出ていなかったせいで「保存が未実装」に見えていた（Issue #52）。
  // console を差し替えるのはここだけ。ログの宛先まで注入する価値は無い。
  it("should not swallow the reason it could not load", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createFakeStore();
    renderHook(() => useHistory("uid-1", store.load));

    await act(async () => {
      store.reject();
    });

    expect(logged).toHaveBeenCalledOnce();
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
