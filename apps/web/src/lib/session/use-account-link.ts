"use client";

import { useCallback, useRef, useState } from "react";

import type { LinkResult, SignInResult } from "./types";

/**
 * アカウントを繋ぐ／すでにあるほうを開く、の段取り。
 *
 * 二つの操作をひとつのフックにまとめているのは、利用者から見ると
 * 「アカウントに繋がりたい」という一つの用事だから。どちらを出すかは
 * その場の状況で決まるものであって、選ばせるものではない。
 *
 * `linkGoogle` が `alreadyInUse` を返したときだけ、開く道に切り替える。その
 * Google はもう向こうのアカウントのもので、繋ぐ操作は何度試しても通らない。
 * 一方で、開けば**いまの匿名側に書いたものが辿れなくなる**ので、行き止まりに
 * 当たるまでは出さない。
 *
 * トップの静かな一行と設定のアカウント欄の両方から使う。同じ判断が二か所に
 * 書かれていると、片方だけ直る日が来る。
 */

export type AccountOutcome =
  | { readonly kind: "link"; readonly result: LinkResult }
  | { readonly kind: "signIn"; readonly result: SignInResult };

export interface AccountLink {
  readonly working: boolean;
  /** 直前の結果。まだ何もしていなければ null。 */
  readonly outcome: AccountOutcome | null;
  /** 繋ぐ先が埋まっていて、開くほかない状態か。 */
  readonly stuck: boolean;
  link(): void;
  open(): void;
}

export function useAccountLink(
  linkGoogle: () => Promise<LinkResult>,
  signInGoogle: () => Promise<SignInResult>,
): AccountLink {
  const [outcome, setOutcome] = useState<AccountOutcome | null>(null);
  const [stuck, setStuck] = useState(false);
  const [working, setWorking] = useState(false);
  // 二度押しの番人。working を見て弾くと、setState が反映される前の連打を通す。
  const running = useRef(false);

  const link = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    void linkGoogle().then((result) => {
      setOutcome({ kind: "link", result });
      setStuck(result === "alreadyInUse");
      running.current = false;
      setWorking(false);
    });
  }, [linkGoogle]);

  /**
   * 開くのをやめても `stuck` は下ろさない。やめただけで、繋ぐ先が埋まって
   * いる事実は何も変わっていない。ここで戻すと、押しても通らないボタンに
   * 戻ってしまう。
   */
  const open = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setWorking(true);
    void signInGoogle().then((result) => {
      setOutcome({ kind: "signIn", result });
      running.current = false;
      setWorking(false);
    });
  }, [signInGoogle]);

  return { working, outcome, stuck, link, open };
}
