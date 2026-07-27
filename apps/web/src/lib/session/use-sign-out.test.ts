import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSignOut } from "./use-sign-out";

/**
 * テスト観点
 *
 * 1. 取り返しがつかないときは、押しただけでは実行しないこと
 * 2. 確認すれば実行すること
 * 3. やめれば何も起きないこと
 * 4. 取り返しがつくときは、確認を挟まずに実行すること
 * 5. 実行中であることが分かること
 * 6. 連打しても一度しか実行しないこと
 * 7. サインアウトに失敗しても、そこで止まらないこと
 *
 * ここで確かめたいのは「取り返しがつかないときにだけ一段挟む」という仕様。
 * 匿名かどうかの判定はこのフックの外にあるので、真偽値として渡す。
 */

/** 呼ばれた回数と、解決する時期を外から決められるサインアウト。 */
function createSignOut() {
  let calls = 0;
  let settle: (() => void) | null = null;

  return {
    signOut: () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        settle = resolve;
      });
    },
    finish: () => settle?.(),
    calls: () => calls,
  };
}

const IRREVERSIBLE = true;
const REVERSIBLE = false;

describe("useSignOut", () => {
  afterEach(cleanup);

  it("should not sign out on the first press when it cannot be undone", () => {
    const auth = createSignOut();

    const { result } = renderHook(() => useSignOut(auth.signOut, IRREVERSIBLE));
    act(() => {
      result.current.request();
    });

    expect(result.current.phase).toBe("confirming");
    expect(auth.calls()).toBe(0);
  });

  it("should sign out once it has been confirmed", async () => {
    const auth = createSignOut();
    const { result } = renderHook(() => useSignOut(auth.signOut, IRREVERSIBLE));
    act(() => {
      result.current.request();
    });

    await act(async () => {
      result.current.confirm();
      auth.finish();
    });

    expect(auth.calls()).toBe(1);
    expect(result.current.phase).toBe("done");
  });

  it("should leave the session alone when the confirmation is declined", () => {
    const auth = createSignOut();
    const { result } = renderHook(() => useSignOut(auth.signOut, IRREVERSIBLE));
    act(() => {
      result.current.request();
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.phase).toBe("idle");
    expect(auth.calls()).toBe(0);
  });

  it("should sign out without confirmation when the account can be opened again", async () => {
    const auth = createSignOut();
    const { result } = renderHook(() => useSignOut(auth.signOut, REVERSIBLE));

    await act(async () => {
      result.current.request();
      auth.finish();
    });

    expect(auth.calls()).toBe(1);
    expect(result.current.phase).toBe("done");
  });

  it("should report that the sign-out is in flight", () => {
    const auth = createSignOut();
    const { result } = renderHook(() => useSignOut(auth.signOut, REVERSIBLE));

    act(() => {
      result.current.request();
    });

    expect(result.current.phase).toBe("working");
  });

  it("should sign out only once however many times it is pressed", async () => {
    const auth = createSignOut();
    const { result } = renderHook(() => useSignOut(auth.signOut, REVERSIBLE));

    await act(async () => {
      result.current.request();
      result.current.request();
      result.current.request();
      auth.finish();
    });

    expect(auth.calls()).toBe(1);
  });

  it("should finish even when signing out fails", async () => {
    const failing = () => Promise.reject(new Error("network"));
    const { result } = renderHook(() => useSignOut(failing, REVERSIBLE));

    await act(async () => {
      result.current.request();
    });

    expect(result.current.phase).toBe("done");
  });
});
