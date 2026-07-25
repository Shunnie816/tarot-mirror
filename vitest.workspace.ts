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
