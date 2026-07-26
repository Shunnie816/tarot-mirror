import { fileURLToPath } from "node:url";

import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "engine",
      root: "./packages/engine",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    // `pnpm validate:decks` runs only this project. Deck data integrity is
    // enforced as a test so a malformed card can never reach the engine.
    test: {
      name: "decks",
      root: "./packages/decks",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "content",
      root: "./packages/content",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    // Cloud Function の判断（断る・上限・引き直す・諦める）はここで踏む。
    // Anthropic も Firestore も注入なので、鍵もネットワークも要らない。
    test: {
      name: "functions",
      root: "./functions",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
    // ワークスペースのパッケージは functions/package.json に書けない
    // （npm が workspace:* を解釈できずデプロイが落ちる）ので、node_modules に
    // リンクが張られない。build.mjs / tsconfig.json と同じ場所をここでも指す。
    resolve: {
      alias: {
        "@tarot-mirror/content/prompt": fileURLToPath(
          new URL("./packages/content/src/prompt.ts", import.meta.url),
        ),
        "@tarot-mirror/content": fileURLToPath(
          new URL("./packages/content/src/index.ts", import.meta.url),
        ),
        "@tarot-mirror/decks": fileURLToPath(
          new URL("./packages/decks/src/index.ts", import.meta.url),
        ),
        "@tarot-mirror/engine": fileURLToPath(
          new URL("./packages/engine/src/index.ts", import.meta.url),
        ),
      },
    },
  },
  {
    // 画面まわりで検証するのは、hooks に切り出したロジックだけ。
    // カードの見た目や DOM の構造はテストしない。
    test: {
      name: "web",
      root: "./apps/web",
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      },
    },
  },
]);
