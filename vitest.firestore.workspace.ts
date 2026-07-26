import { defineWorkspace } from "vitest/config";

/**
 * エミュレータを必要とするテスト。
 *
 * `vitest.workspace.ts` から外してあるのは、`pnpm test` を Java もエミュレータも
 * 無い環境で通したままにするため。CI は別ステップとして走らせる。
 *
 *   pnpm test:firestore
 *
 * ワークスペースファイルとして分けているのは、`--config` だけでは
 * `vitest.workspace.ts` の定義が優先されて通常のテストが走ってしまうため。
 */
export default defineWorkspace([
  {
    test: {
      name: "firestore",
      include: ["tests/firestore/**/*.test.ts"],
      environment: "node",
      // エミュレータへの往復があるので既定のタイムアウトでは足りない。
      testTimeout: 20_000,
      hookTimeout: 30_000,
    },
  },
]);
