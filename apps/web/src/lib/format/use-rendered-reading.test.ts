import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  renderTemplate,
  THREE_CARDS,
  type LlmFormatOutput,
} from "@tarot-mirror/engine";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateFormatPort, FormatPort } from "./types";
import { useRenderedReading } from "./use-rendered-reading";

/**
 * 観点
 *
 * 1. 呼べないときは待たせずテンプレートで確定する
 * 2. 間に合った答えは本文だけを差し替える
 * 3. 時間切れになったらテンプレートで確定する
 * 4. **確定したあとに届いた答えは捨てる**（読んでいる最中に書き換わらない）
 * 5. 落ちても・外しても、読み物は必ず残る
 */

const source = createReading({
  spread: THREE_CARDS,
  deck: riderWaite,
  seed: "use-rendered",
  now: () => new Date("2026-07-25T00:00:00.000Z"),
});

const template = renderTemplate(source, "ja");

const output = (text: string): LlmFormatOutput => ({
  positions: template.positions.map((position) => ({
    positionId: position.positionId,
    text,
  })),
  synthesis: "三枚をならべると、静かな移り変わりが見えてくるかもしれません。",
  closingQuestion: "いま、手放さずにいるものは何でしょうか。",
});

const CLEAN = output("そう受け取ることもできます。");

/** renderHook のコールバック外で作る。中で作ると毎レンダー新しい参照になる。 */
const portReturning = (answer: LlmFormatOutput | null): CreateFormatPort => {
  const port: FormatPort = { format: async () => answer };
  return async () => port;
};

const noPort: CreateFormatPort = async () => null;

const failingPort: CreateFormatPort = async () => ({
  format: async () => {
    throw new Error("offline");
  },
});

/** 決着を外から握れる port。時間切れの前後を作り分けるために使う。 */
function deferredPort(): {
  readonly create: CreateFormatPort;
  readonly resolve: (answer: LlmFormatOutput) => void;
} {
  let release: (answer: LlmFormatOutput) => void = () => undefined;
  const pending = new Promise<LlmFormatOutput>((r) => {
    release = r;
  });
  const port: FormatPort = { format: () => pending };

  return { create: async () => port, resolve: (a) => release(a) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useRenderedReading", () => {
  it("should settle on the template when there is nothing to call", async () => {
    const { result } = renderHook(() =>
      useRenderedReading(source, template, noPort),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading).toEqual(template);
  });

  it("should show the llm prose when the answer arrives in time", async () => {
    const { result } = renderHook(() =>
      useRenderedReading(source, template, portReturning(CLEAN)),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading.mode).toBe("llm");
    expect(result.current.reading.positions[0]?.text).toBe(
      "そう受け取ることもできます。",
    );
  });

  it("should keep the card names even when the prose is replaced", async () => {
    const { result } = renderHook(() =>
      useRenderedReading(source, template, portReturning(CLEAN)),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading.positions.map((p) => p.cardName)).toEqual(
      template.positions.map((p) => p.cardName),
    );
  });

  it("should settle on the template once it has waited long enough", async () => {
    vi.useFakeTimers();
    const { create } = deferredPort();

    const { result } = renderHook(() =>
      useRenderedReading(source, template, create, { timeoutMs: 100 }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });

    expect(result.current.settling).toBe(false);
    expect(result.current.reading.mode).toBe("template");
  });

  /**
   * 時間切れのあとに届いたものを当てにいくと、読んでいる途中で本文が
   * 入れ替わる。読む側からすればそれは故障に見える。
   */
  it("should ignore an answer that arrives after it has settled", async () => {
    vi.useFakeTimers();
    const { create, resolve } = deferredPort();

    const { result } = renderHook(() =>
      useRenderedReading(source, template, create, { timeoutMs: 100 }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });
    await act(async () => {
      resolve(CLEAN);
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(result.current.reading.mode).toBe("template");
  });

  it("should settle on the template when the call fails", async () => {
    const fallbacks: string[] = [];
    const options = { onFallback: (r: string) => fallbacks.push(r) };
    const { result } = renderHook(() =>
      useRenderedReading(source, template, failingPort, options),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading).toEqual(template);
    expect(fallbacks).toEqual(["unavailable"]);
  });

  it("should throw away an answer that breaks the tone rules", async () => {
    const fallbacks: string[] = [];
    const options = { onFallback: (r: string) => fallbacks.push(r) };
    const create = portReturning(output("必ず前に進めます。"));
    const { result } = renderHook(() =>
      useRenderedReading(source, template, create, options),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading.mode).toBe("template");
    expect(fallbacks).toEqual(["rejected"]);
  });

  /**
   * 通知の受け口をその場で書いても回り続けないこと。
   * effect の依存に関数を置くと、レンダーのたびに新しい参照が生まれて
   * 起動し続ける（CLAUDE.md の renderHook の注意点）。
   */
  it("should not re-run when the caller writes the callback inline", async () => {
    let calls = 0;
    const create: CreateFormatPort = async () => {
      calls += 1;
      return { format: async () => CLEAN };
    };

    const { result, rerender } = renderHook(() =>
      useRenderedReading(source, template, create, {
        onFallback: () => undefined,
      }),
    );

    await waitFor(() => expect(result.current.settling).toBe(false));
    rerender();
    rerender();

    expect(calls).toBe(1);
  });

  /** サインインの結果を待つあいだは、まだ本文を出さない。 */
  it("should keep waiting while it is not yet known whether it can call", async () => {
    const create = portReturning(CLEAN);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean | undefined }) =>
        useRenderedReading(source, template, create, { enabled }),
      { initialProps: { enabled: undefined as boolean | undefined } },
    );

    expect(result.current.settling).toBe(true);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading.mode).toBe("llm");
  });

  it("should settle on the template as soon as it learns it cannot call", async () => {
    const create = portReturning(CLEAN);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean | undefined }) =>
        useRenderedReading(source, template, create, { enabled }),
      { initialProps: { enabled: undefined as boolean | undefined } },
    );

    rerender({ enabled: false });

    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading).toEqual(template);
  });

  /**
   * 時間切れで本文を出したあとにサインインが済むことがある。そこで待ちに
   * 戻ると、読み始めた人の画面が伏せ直される。
   */
  it("should not hide the prose again once it has been shown", async () => {
    vi.useFakeTimers();
    const create = portReturning(CLEAN);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean | undefined }) =>
        useRenderedReading(source, template, create, {
          enabled,
          timeoutMs: 100,
        }),
      { initialProps: { enabled: undefined as boolean | undefined } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });
    expect(result.current.settling).toBe(false);

    rerender({ enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(result.current.settling).toBe(false);
    expect(result.current.reading.mode).toBe("template");
  });

  it("should never leave the reader without a reading", async () => {
    const { result } = renderHook(() =>
      useRenderedReading(source, template, failingPort),
    );

    expect(result.current.reading.positions).toHaveLength(3);
    await waitFor(() => expect(result.current.settling).toBe(false));
    expect(result.current.reading.positions).toHaveLength(3);
  });
});
