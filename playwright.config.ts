import { defineConfig, devices } from "@playwright/test";

/**
 * 通しで動くことだけを確かめる。
 *
 * 単体テストは 275 件あり、ロジックはそちらで埋まっている。ここで見るのは
 * 「ブラウザで引いて、読んで、残るところまでが繋がっているか」だけ。
 * 数を増やすと、壊れていないのに赤くなるテストが積み上がって誰も見なくなる。
 *
 * v0.1 では単体もルールテストも全部緑のまま、本番の保存が丸ごと死んでいた
 * （Issue #52）。エミュレータのルールテストは `firestore.rules` を直接読むので、
 * 「画面から保存まで繋がっているか」は原理的に踏めない。ここがその穴を埋める。
 *
 * エミュレータは `firebase.json` 越しに `firestore.rules` を読む。
 * つまりこのテストは**実際のセキュリティルール越しに**動いている。
 */

/** 開発中の `pnpm dev`（3000）と喧嘩させない。 */
const PORT = 3100;

/**
 * `demo-` で始まる ID は Firebase が「エミュレータ専用」として扱い、
 * 本物の資格情報を一切要求しない。取り違えて本番を触る事故が起こらない。
 */
const PROJECT_ID = "demo-tarot-mirror-e2e";

/** クライアントが読む設定。エミュレータ相手なので中身は何でもよいが、揃える。 */
const webEnv = {
  NEXT_PUBLIC_FIREBASE_EMULATORS: "1",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:demo",
};

export default defineConfig({
  testDir: "./tests/e2e",

  // エミュレータへの往復と Next の初回コンパイルがあるので、既定では足りない。
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // エミュレータの中身は全テストで共有している。並行に走らせると、
  // 履歴の件数を見ているテストが他のテストの書き込みを数えてしまう。
  fullyParallel: false,
  workers: 1,

  // CI での1回だけの再試行。ここで消える失敗は本物ではないことが多いが、
  // 2回以上入れると本物の不安定さが見えなくなる。
  retries: process.env.CI !== undefined ? 1 : 0,
  reporter: process.env.CI !== undefined ? "github" : "list",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // 落ちたときだけ残す。通ったぶんまで残すとログが膨らむだけ。
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: `npx --yes firebase-tools@15 emulators:start --only auth,firestore --project ${PROJECT_ID}`,
      // Firestore の口が開いたら、Auth も一緒に上がっている。
      port: 8080,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm --filter @tarot-mirror/web dev --port ${PORT}`,
      port: PORT,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 180_000,
      env: webEnv,
    },
  ],
});
