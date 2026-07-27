import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";

import type { AuthPort, LinkResult, SessionUser, SignInResult } from "./types";

/**
 * `AuthPort` の Firebase 実装。
 *
 * Firebase のエラーコードが外に出るのはここまで。画面側は `LinkResult` の
 * 4語だけを知っていればよく、`auth/popup-closed-by-user` のような文字列を
 * UI のコードが持たずに済む。
 *
 * このファイルは動的 import 越しにのみ読み込む。静的に import すると SDK が
 * 初期バンドルに載り、保存を使わない人にも読み込みの重さを負わせる。
 */

/** 利用者が自分で閉じた場合。失敗として扱うと、やめただけなのに謝られる。 */
const CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

/** すでに別のアカウントとして存在している場合。匿名側の記録は残る。 */
const ALREADY_IN_USE_CODES = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
  "auth/account-exists-with-different-credential",
]);

function toSessionUser(user: User): SessionUser {
  return { uid: user.uid, isAnonymous: user.isAnonymous };
}

export function createFirebaseAuthPort(): AuthPort {
  const auth = getFirebaseAuth();

  return {
    /**
     * `onAuthStateChanged` ではなく `onIdTokenChanged` を使う。
     * アカウントを繋いだとき、Firebase は同じ User オブジェクトを書き換えて
     * トークンだけを更新する。サインインとサインアウトしか見ない前者では
     * 「匿名でなくなった」瞬間を受け取れず、画面が匿名のまま取り残される。
     */
    subscribe: (listener) =>
      onIdTokenChanged(auth, (user) => {
        listener(user === null ? null : toSessionUser(user));
      }),

    signInAnonymously: async () => {
      await signInAnonymously(auth);
    },

    /**
     * 匿名アカウントに Google を紐付ける。新しいアカウントを作るのではなく
     * リンクするので、匿名のうちに書いたものはそのまま引き継がれる。
     */
    linkGoogle: async (): Promise<LinkResult> => {
      const current = auth.currentUser;
      if (current === null) return "failed";

      try {
        await linkWithPopup(current, new GoogleAuthProvider());
        return "linked";
      } catch (error) {
        if (error instanceof FirebaseError) {
          if (CANCELLED_CODES.has(error.code)) return "cancelled";
          if (ALREADY_IN_USE_CODES.has(error.code)) return "alreadyInUse";
        }
        return "failed";
      }
    },

    /**
     * すでにある Google アカウントを開く。`linkWithPopup` と違って、いまの
     * uid には何も起きない。匿名のまま呼ぶと、その匿名アカウントに書いたものは
     * 残ったまま辿れなくなるので、呼ぶ側がそれを伝えてから呼ぶ。
     */
    signInGoogle: async (): Promise<SignInResult> => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        return "signedIn";
      } catch (error) {
        if (error instanceof FirebaseError && CANCELLED_CODES.has(error.code)) {
          return "cancelled";
        }
        return "failed";
      }
    },

    /**
     * 失敗しても投げない。サインアウトが例外で止まると、画面は繋がったまま
     * なのに利用者は離れたつもりでいる、といういちばん困る食い違いが起きる。
     * 実際に離れられたかどうかは、このあと購読が流す利用者で分かる。
     */
    signOut: async () => {
      try {
        await signOut(auth);
      } catch {
        // 次の購読通知が本当の状態を教えてくれる。
      }
    },
  };
}
