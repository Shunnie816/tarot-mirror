import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  type Functions,
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";

import { readFirebaseOptions, useEmulators } from "./config";

/**
 * Firebase クライアント本体。
 *
 * このファイルは動的 import 越しにのみ読み込む（`lib/session/provider.tsx`）。
 * カードを引いて読むところまでは Firebase に一切触れないので、SDK を初期バンドルに
 * 載せると、保存を使わない人にも読み込みの重さだけを負わせることになる。
 *
 * 初期化はブラウザでのみ行う。SSR 中にも走らせると、誰も使っていない匿名セッションが
 * サーバー側で作られてしまう。
 */

const EMULATOR_AUTH_URL = "http://127.0.0.1:9099";
const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_FIRESTORE_PORT = 8080;
const EMULATOR_FUNCTIONS_PORT = 5001;

/** Firestore のロケーションは変更できないので、Function もここに固定。 */
const FUNCTIONS_REGION = "asia-northeast1";

let auth: Auth | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;

function app(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  const options = readFirebaseOptions();
  if (options === null) {
    // ここに来るのは isFirebaseConfigured() を確かめずに呼んだときだけ。
    throw new Error("Firebase の設定値がない");
  }
  return initializeApp(options);
}

export function getFirebaseAuth(): Auth {
  if (auth === undefined) {
    auth = getAuth(app());
    if (useEmulators) connectAuthEmulator(auth, EMULATOR_AUTH_URL);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (db === undefined) {
    db = getFirestore(app());
    if (useEmulators) {
      connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_FIRESTORE_PORT);
    }
  }
  return db;
}

export function getFirebaseFunctions(): Functions {
  if (functions === undefined) {
    functions = getFunctions(app(), FUNCTIONS_REGION);
    if (useEmulators) {
      connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_FUNCTIONS_PORT);
    }
  }
  return functions;
}
