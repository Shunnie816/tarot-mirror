import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AuthPort, CreateAuthPort, LinkResult, SessionUser } from "./types";
import { useSessionState } from "./use-session-state";

/**
 * テスト観点
 *
 *  1. 認証の応答を待っているあいだの状態
 *  2. 利用者が通知されたときに uid が読めること
 *  3. 利用者がいないときに匿名で始めること（サインアップを求めない）
 *  4. 匿名アカウントを重複して作らないこと
 *  5. 匿名サインインに失敗しても壊れず「保存できない状態」に落ちること
 *  6. そこからやり直せること
 *  7. Firebase の設定値がないときも同じ「保存できない状態」になること
 *  8. 認証そのものの読み込みに失敗しても同じところへ落ちること
 *  9. アンマウントで購読をやめること
 * 10. アカウント接続の結果が呼び出し側に伝わること
 *
 * 認証はフェイクを注入して検証する。ここで検証したいのは Firebase の挙動ではなく
 * 「利用者がいなければ黙って始め、駄目なら読むことだけは続けられる」という仕様。
 */

const ANONYMOUS: SessionUser = { uid: "anon-1", isAnonymous: true };
const LINKED: SessionUser = { uid: "anon-1", isAnonymous: false };

/** 設定値が無い環境。port が作れない。 */
const noPort: CreateAuthPort = () => Promise.resolve(null);

/** SDK の読み込み自体が失敗する環境（回線が切れている等）。 */
const brokenPort: CreateAuthPort = () => Promise.reject(new Error("offline"));

interface FakeAuth {
  readonly createPort: CreateAuthPort;
  emit(user: SessionUser | null): void;
  completeSignIn(user: SessionUser): void;
  failSignIn(): void;
  signInCalls(): number;
  isListening(): boolean;
  setLinkResult(result: LinkResult): void;
}

function createFakeAuth(initial: SessionUser | null = null): FakeAuth {
  let listener: ((user: SessionUser | null) => void) | null = null;
  let current = initial;
  let signInCalls = 0;
  let pending: { resolve: () => void; reject: (reason: Error) => void } | null = null;
  let linkResult: LinkResult = "linked";

  const emit = (user: SessionUser | null): void => {
    current = user;
    listener?.(user);
  };

  const port: AuthPort = {
    subscribe(next) {
      listener = next;
      // 本物の onAuthStateChanged も、購読した時点で現在の状態を一度流す。
      next(current);
      return () => {
        listener = null;
      };
    },
    signInAnonymously() {
      signInCalls += 1;
      return new Promise<void>((resolve, reject) => {
        pending = { resolve, reject };
      });
    },
    linkGoogle: () => Promise.resolve(linkResult),
  };

  return {
    createPort: () => Promise.resolve(port),
    emit,
    completeSignIn(user) {
      pending?.resolve();
      emit(user);
    },
    failSignIn() {
      pending?.reject(new Error("sign-in unavailable"));
    },
    signInCalls: () => signInCalls,
    isListening: () => listener !== null,
    setLinkResult(result) {
      linkResult = result;
    },
  };
}

/** 認証の用意は非同期。購読が張られるところまで進めてから検証する。 */
async function mountSession(createPort: CreateAuthPort) {
  const rendered = renderHook(() => useSessionState(createPort));
  await act(async () => {});
  return rendered;
}

describe("useSessionState", () => {
  afterEach(cleanup);

  it("should stay connecting while the sign-in is in flight", async () => {
    const auth = createFakeAuth();

    const { result } = await mountSession(auth.createPort);

    expect(result.current.status).toBe("connecting");
    expect(result.current.user).toBeNull();
  });

  it("should become ready when a user is reported", async () => {
    const auth = createFakeAuth(ANONYMOUS);

    const { result } = await mountSession(auth.createPort);

    expect(result.current.status).toBe("ready");
    expect(result.current.user?.uid).toBe("anon-1");
  });

  it("should sign in anonymously when there is no user", async () => {
    const auth = createFakeAuth();
    const { result } = await mountSession(auth.createPort);

    act(() => {
      auth.completeSignIn(ANONYMOUS);
    });

    expect(auth.signInCalls()).toBe(1);
    expect(result.current.status).toBe("ready");
    expect(result.current.user?.isAnonymous).toBe(true);
  });

  it("should not start a second anonymous sign-in while one is unresolved", async () => {
    const auth = createFakeAuth();
    await mountSession(auth.createPort);

    act(() => {
      auth.emit(null);
      auth.emit(null);
    });

    expect(auth.signInCalls()).toBe(1);
  });

  it("should fall back to an unsaved session when sign-in fails", async () => {
    const auth = createFakeAuth();
    const { result } = await mountSession(auth.createPort);

    await act(async () => {
      auth.failSignIn();
    });

    expect(result.current.status).toBe("unavailable");
  });

  it("should try again when asked to retry", async () => {
    const auth = createFakeAuth();
    const { result } = await mountSession(auth.createPort);
    await act(async () => {
      auth.failSignIn();
    });

    await act(async () => {
      result.current.retry();
    });

    expect(auth.signInCalls()).toBe(2);
    expect(result.current.status).toBe("connecting");
  });

  it("should report an unsaved session when firebase is not configured", async () => {
    const { result } = await mountSession(noPort);

    expect(result.current.status).toBe("unavailable");
    expect(result.current.user).toBeNull();
  });

  it("should report an unsaved session when the auth service cannot be loaded", async () => {
    const { result } = await mountSession(brokenPort);

    expect(result.current.status).toBe("unavailable");
  });

  it("should stop listening once unmounted", async () => {
    const auth = createFakeAuth(ANONYMOUS);
    const { unmount } = await mountSession(auth.createPort);

    unmount();

    expect(auth.isListening()).toBe(false);
  });

  it("should report the outcome of linking an account", async () => {
    const auth = createFakeAuth(ANONYMOUS);
    auth.setLinkResult("alreadyInUse");
    const { result } = await mountSession(auth.createPort);

    const outcome = await result.current.linkGoogle();

    expect(outcome).toBe("alreadyInUse");
  });

  it("should report the linked user once the account is connected", async () => {
    const auth = createFakeAuth(ANONYMOUS);
    const { result } = await mountSession(auth.createPort);

    act(() => {
      auth.emit(LINKED);
    });

    expect(result.current.user?.isAnonymous).toBe(false);
  });
});
