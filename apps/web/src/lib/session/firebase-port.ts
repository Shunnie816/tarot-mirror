import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";

import type { AuthPort, LinkResult, SessionUser } from "./types";

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
  };
}
