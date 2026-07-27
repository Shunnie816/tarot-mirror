"use client";

import { useCallback, useRef, useState } from "react";

/**
 * サインアウトの段取り。
 *
 * ボタンひとつにしない理由がある。匿名のまま離れると、その uid は取り直せない。
 * 書いたものは消えないが、開く手立てだけが無くなる。「ログアウト」という言葉から
 * 想像される可逆さと、実際に起きることが食い違っているので、そこだけ一段挟む。
 *
 * 逆に、アカウントを繋いである人には挟まない。もう一度そのアカウントを開けば
 * 同じものが出てくるので、確認は儀式にしかならない。取り返しがつくかどうかで
 * 分けるのであって、操作の重さで分けるのではない。
 *
 * 判断材料は引数で受け取る。`useSession` をここから呼ばないのは、段取りだけを
 * 切り出して確かめられるようにするため。
 */

export type SignOutPhase = "idle" | "confirming" | "working" | "done";

export interface SignOutFlow {
  readonly phase: SignOutPhase;
  /** 押された。取り返しがつかないなら、まだ実行しない。 */
  request(): void;
  /** 分かった上で進む。 */
  confirm(): void;
  cancel(): void;
}

export function useSignOut(
  signOut: () => Promise<void>,
  irreversible: boolean,
): SignOutFlow {
  const [phase, setPhase] = useState<SignOutPhase>("idle");
  // 二度押しの番人。phase を見て弾くと、setState が反映される前の連打を通す。
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPhase("working");
    try {
      await signOut();
    } catch {
      // 失敗しても `done` にする。ここで「失敗しました」と出しても、利用者に
      // できることが無い。実際に離れられたかどうかは、このあと画面に出る
      // アカウントの状態が示す。
    }
    running.current = false;
    setPhase("done");
  }, [signOut]);

  const request = useCallback(() => {
    if (irreversible) {
      setPhase("confirming");
      return;
    }
    void run();
  }, [irreversible, run]);

  const confirm = useCallback(() => {
    void run();
  }, [run]);

  const cancel = useCallback(() => {
    setPhase("idle");
  }, []);

  return { phase, request, confirm, cancel };
}
