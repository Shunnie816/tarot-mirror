import type { FirebaseOptions } from "firebase/app";

/**
 * 設定値の読み取りだけを持つ。
 *
 * Firebase の実体を一切 import しないので、このファイルを読んでも SDK は
 * ダウンロードされない。「設定されているか」を Firebase を読み込む前に
 * 判断できるようにするためのファイル。
 *
 * Next は `process.env.NEXT_PUBLIC_*` を静的な参照としてのみ置換するので、
 * キーを組み立てて引くことはできない。ここは1つずつ書く。
 */
const env = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

/** 4つ揃って初めて設定とみなす。欠けていたら保存のない状態で動かす。 */
export function readFirebaseOptions(): FirebaseOptions | null {
  const { apiKey, authDomain, projectId, appId } = env;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseOptions() !== null;
}
