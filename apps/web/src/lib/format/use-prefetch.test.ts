import { riderWaite } from "@tarot-mirror/decks";
import { createReading, THREE_CARDS } from "@tarot-mirror/engine";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePrefetchFormatting, type AskToFormat } from "./use-prefetch";

/**
 * 観点
 *
 * 1. 設定がオフなら投げない（使わないものに払わない）
 * 2. サインインが済むまで投げない
 * 3. **同じ引きに二度投げない** — ここだけは間違えるとそのまま課金される
 * 4. 失敗しても呼び出し側に持ち出さない
 */

const reading = (seed = "prefetch") =>
  createReading({
    spread: THREE_CARDS,
    deck: riderWaite,
    seed,
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

const source = reading();

function recorder(): AskToFormat & { readonly calls: () => number } {
  let calls = 0;
  const ask: AskToFormat = async () => {
    calls += 1;
  };
  return Object.assign(ask, { calls: () => calls });
}

describe("usePrefetchFormatting", () => {
  it("should not ask when the setting is off", async () => {
    const ask = recorder();
    const options = { enabled: false, uid: "someone" };

    renderHook(() => usePrefetchFormatting(source, ask, options));

    await waitFor(() => expect(ask.calls()).toBe(0));
  });

  it("should not ask before there is someone to ask for", async () => {
    const ask = recorder();
    const options = { enabled: true, uid: null };

    renderHook(() => usePrefetchFormatting(source, ask, options));

    await waitFor(() => expect(ask.calls()).toBe(0));
  });

  it("should ask once the session is ready", async () => {
    const ask = recorder();
    const options = { enabled: true, uid: "someone" };

    renderHook(() => usePrefetchFormatting(source, ask, options));

    await waitFor(() => expect(ask.calls()).toBe(1));
  });

  /**
   * 認証はトークンを更新するたびに新しいセッションを流す。素直に書くと、
   * カードを置いている数十秒のあいだに何度も投げて、そのぶん課金される。
   */
  it("should not ask twice for the same reading", async () => {
    const ask = recorder();
    const { rerender } = renderHook(
      ({ uid }: { uid: string | null }) =>
        usePrefetchFormatting(source, ask, { enabled: true, uid }),
      { initialProps: { uid: null as string | null } },
    );

    rerender({ uid: "someone" });
    await waitFor(() => expect(ask.calls()).toBe(1));

    // 同じ人・同じ引きのまま何度レンダーされても増えない。
    rerender({ uid: "someone" });
    rerender({ uid: "someone-after-token-refresh" });
    rerender({ uid: "someone" });

    await waitFor(() => expect(ask.calls()).toBe(1));
  });

  it("should ask again for a different draw", async () => {
    const ask = recorder();
    const { rerender } = renderHook(
      ({ seed }: { seed: string }) =>
        usePrefetchFormatting(reading(seed), ask, {
          enabled: true,
          uid: "someone",
        }),
      { initialProps: { seed: "one" } },
    );

    await waitFor(() => expect(ask.calls()).toBe(1));
    rerender({ seed: "two" });

    await waitFor(() => expect(ask.calls()).toBe(2));
  });

  it("should swallow a failure rather than surface it", async () => {
    const failing: AskToFormat = async () => {
      throw new Error("offline");
    };
    const options = { enabled: true, uid: "someone" };

    expect(() =>
      renderHook(() => usePrefetchFormatting(source, failing, options)),
    ).not.toThrow();
  });
});
