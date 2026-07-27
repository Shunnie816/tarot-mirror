import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LinkResult, SignInResult } from "./types";
import { useAccountLink } from "./use-account-link";

/**
 * テスト観点
 *
 * 1. 繋いだ結果が読み取れること
 * 2. 繋ぐ先が埋まっていたら、開く道に切り替わること
 * 3. 開いた結果が読み取れること
 * 4. 開くのをやめても、開く道のままでいること
 * 5. やめただけのときは、開く道に切り替えないこと
 * 6. 実行中であることが分かること
 * 7. 連打しても一度しか呼ばないこと
 *
 * 4 と 5 が、このフックの居場所。「繋げない」と「やめた」を同じ扱いにすると、
 * 押しても通らないボタンに戻ってしまう。
 */

function createAuth() {
  let linkCalls = 0;
  let signInCalls = 0;
  let linkResult: LinkResult = "linked";
  let signInResult: SignInResult = "signedIn";

  return {
    linkGoogle: () => {
      linkCalls += 1;
      return Promise.resolve(linkResult);
    },
    signInGoogle: () => {
      signInCalls += 1;
      return Promise.resolve(signInResult);
    },
    setLinkResult(result: LinkResult) {
      linkResult = result;
    },
    setSignInResult(result: SignInResult) {
      signInResult = result;
    },
    linkCalls: () => linkCalls,
    signInCalls: () => signInCalls,
  };
}

describe("useAccountLink", () => {
  afterEach(cleanup);

  it("should report the outcome of connecting an account", async () => {
    const auth = createAuth();
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );

    await act(async () => {
      result.current.link();
    });

    expect(result.current.outcome).toEqual({ kind: "link", result: "linked" });
    expect(result.current.stuck).toBe(false);
  });

  it("should offer to open the account instead when it is already taken", async () => {
    const auth = createAuth();
    auth.setLinkResult("alreadyInUse");
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );

    await act(async () => {
      result.current.link();
    });

    expect(result.current.stuck).toBe(true);
  });

  it("should report the outcome of opening the existing account", async () => {
    const auth = createAuth();
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );

    await act(async () => {
      result.current.open();
    });

    expect(result.current.outcome).toEqual({
      kind: "signIn",
      result: "signedIn",
    });
  });

  it("should keep offering to open it after the reader backs out", async () => {
    const auth = createAuth();
    auth.setLinkResult("alreadyInUse");
    auth.setSignInResult("cancelled");
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );
    await act(async () => {
      result.current.link();
    });

    await act(async () => {
      result.current.open();
    });

    expect(result.current.stuck).toBe(true);
  });

  it("should not switch to opening when the reader simply cancelled", async () => {
    const auth = createAuth();
    auth.setLinkResult("cancelled");
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );

    await act(async () => {
      result.current.link();
    });

    expect(result.current.stuck).toBe(false);
  });

  it("should report that the attempt is in flight", () => {
    const pending = () => new Promise<LinkResult>(() => undefined);
    const auth = createAuth();
    const { result } = renderHook(() =>
      useAccountLink(pending, auth.signInGoogle),
    );

    act(() => {
      result.current.link();
    });

    expect(result.current.working).toBe(true);
  });

  it("should ask only once however many times it is pressed", async () => {
    const auth = createAuth();
    const { result } = renderHook(() =>
      useAccountLink(auth.linkGoogle, auth.signInGoogle),
    );

    await act(async () => {
      result.current.link();
      result.current.link();
      result.current.link();
    });

    expect(auth.linkCalls()).toBe(1);
  });
});
