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
]);
