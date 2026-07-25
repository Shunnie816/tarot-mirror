/**
 * セッションの境界。
 *
 * ここには Firebase の型が出てこない。認証は「利用者が誰か」を教えてくれる
 * 外部装置というだけで、アプリ側の関心は uid と、それが仮のものかどうかだけ。
 * 境界をこの形にしておくと、セッションの状態遷移をフェイクの実装だけで
 * テストできる（`use-session-state.test.ts`）。
 */

export interface SessionUser {
  readonly uid: string;
  /** 匿名のままか。アカウントを繋いだあとは false になる。 */
  readonly isAnonymous: boolean;
}

/**
 * アカウントを繋ぐ試みの結果。
 *
 * Firebase のエラーコードをそのまま UI に漏らさないための語彙。呼ぶ側は
 * この4つだけを知っていればよく、`auth/popup-closed-by-user` のような
 * 文字列が画面のコードに現れない。
 */
export type LinkResult = "linked" | "cancelled" | "alreadyInUse" | "failed";

export interface AuthPort {
  /** 現在の利用者を通知する。購読開始時にも一度呼ばれる。戻り値は購読解除。 */
  subscribe(listener: (user: SessionUser | null) => void): () => void;
  signInAnonymously(): Promise<void>;
  linkGoogle(): Promise<LinkResult>;
}

/**
 * 認証を用意する。非同期なのは、Firebase SDK をブラウザに来てから、
 * かつ保存が必要になって初めて読み込むため（初期バンドルに載せない）。
 * 設定値がない環境では `null` を返す。
 */
export type CreateAuthPort = () => Promise<AuthPort | null>;

/**
 * `connecting` は認証の応答待ち。`unavailable` は保存できない状態で、
 * これは異常ではなく想定された状態のひとつ。オフラインでも設定値がなくても
 * カードを引いて読むことはできる、というのがこのアプリの前提なので、
 * ここで画面を落とさない。
 */
export type SessionStatus = "connecting" | "ready" | "unavailable";

export interface Session {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
  /** アカウントを繋ぐ。匿名のときに書いたものはそのまま引き継がれる。 */
  linkGoogle(): Promise<LinkResult>;
  /** `unavailable` からやり直す。 */
  retry(): void;
}
