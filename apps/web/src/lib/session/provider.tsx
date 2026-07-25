"use client";

import { createContext, useContext } from "react";

import { isFirebaseConfigured } from "@/lib/firebase/config";

import type { AuthPort, Session } from "./types";
import { useSessionState } from "./use-session-state";

/**
 * Firebase を必要になった時点で読み込む。
 *
 * 設定値の有無は SDK を読む前に判断できる（`config.ts` は Firebase を
 * import していない）ので、設定のない環境では1バイトも取りに行かない。
 *
 * モジュール直下の関数として定義しているのは識別子を安定させるため。
 * レンダーごとに新しい関数を渡すと購読が張り直され続ける。
 */
const createPort = async (): Promise<AuthPort | null> => {
  if (!isFirebaseConfigured()) return null;
  const { createFirebaseAuthPort } = await import("./firebase-port");
  return createFirebaseAuthPort();
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = useSessionState(createPort);

  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error("useSession は <SessionProvider> の内側で使う");
  }
  return session;
}
