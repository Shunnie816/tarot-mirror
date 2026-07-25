"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AuthPort,
  CreateAuthPort,
  LinkResult,
  Session,
  SessionStatus,
  SessionUser,
} from "./types";

/**
 * セッションの状態機械。
 *
 * 「まず引いてみる」までの摩擦をゼロにするため、サインアップは求めず、
 * 利用者がいなければ黙って匿名で始める。この流れのどこにも「ログインしてください」を
 * 出さないのが要件なので、認証が失敗したときの行き先も「エラー画面」ではなく
 * 「保存のない状態」になる。カードを引いて読むことは最後まで続けられる。
 *
 * `createPort` を受け取るのは、Firebase の読み込みをブラウザまで遅らせるため
 * （SSR 中に匿名アカウントを作らせない・初期バンドルに SDK を載せない）。
 * 同時に、テストがフェイクを差し込む口にもなっている。識別子は安定させること。
 * レンダーごとに新しい関数を渡すと購読が張り直され続ける。
 */
export function useSessionState(createPort: CreateAuthPort): Session {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const portRef = useRef<AuthPort | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    // 匿名サインインは「利用者がいない」1回につき1度だけ。認証は結果が出るまでに
    // 何度か null を流すので、この番人がいないと匿名アカウントが複数作られ、
    // 最初のアカウントに書いたものが誰にも辿れなくなる。
    let signingIn = false;

    setStatus("connecting");

    void createPort()
      .then((port) => {
        if (!active) return;
        portRef.current = port;

        if (port === null) {
          setStatus("unavailable");
          return;
        }

        unsubscribe = port.subscribe((next) => {
          if (!active) return;
          setUser(next);

          if (next !== null) {
            signingIn = false;
            setStatus("ready");
            return;
          }

          if (signingIn) return;
          signingIn = true;
          void port.signInAnonymously().catch(() => {
            if (!active) return;
            signingIn = false;
            setStatus("unavailable");
          });
        });
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [createPort, attempt]);

  const linkGoogle = useCallback(async (): Promise<LinkResult> => {
    const port = portRef.current;
    if (port === null) return "failed";
    return port.linkGoogle();
  }, []);

  const retry = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);

  return { status, user, linkGoogle, retry };
}
