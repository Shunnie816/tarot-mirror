import { readFileSync } from "node:fs";

import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * テスト観点
 *
 *  1. 自分の領域は読める・書ける
 *  2. 他人の領域は読めない・書けない（Issue #8 の完了条件）
 *  3. サインインしていなければ何も読めない・書けない
 *  4. リーディングも Journal もプロフィールも同じ扱い
 *  5. ルールに書いていないパスは誰も触れない（既定が拒否であることの確認）
 *
 * Journal は定義上プライベート。共有機能を MVP に入れないという判断が、
 * ここで実行可能な形になっている。
 *
 * ルールで検証しているのは所有権だけで、項目の形は見ていない。自分の領域にしか
 * 書けない以上、壊せるのは自分のデータだけで、守る相手がいない。形の検証は
 * `reading-doc.ts` 側の責務にしてある。
 */

// ファイルごとに別のプロジェクトを使う。エミュレータはプロジェクト単位で
// データを分けるので、並行に走っても互いの土台を消し合わない。
// `demo-` 始まりは本番に触れないことが保証された名前空間。
const PROJECT_ID = "demo-tarot-mirror-rules";

const OWNER = "owner-uid";
const STRANGER = "stranger-uid";

/** 本人・他人・未サインインの3者から同じ場所を触る。 */
const PATHS = [
  ["プロフィール", `users/${OWNER}`],
  ["リーディング", `users/${OWNER}/readings/threeCards-seed`],
  ["Journal", `users/${OWNER}/journal/entry-1`],
  ["整形された読み物", `users/${OWNER}/renderings/abc123`],
] as const;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("firestore rules", () => {
  describe.each(PATHS)("%s", (_label, path) => {
    it("should let the owner read it", async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();

      await assertSucceeds(getDoc(doc(db, path)));
    });

    it("should let the owner write it", async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();

      await assertSucceeds(setDoc(doc(db, path), { body: "書いたもの" }));
    });

    it("should not let anyone else read it", async () => {
      const db = testEnv.authenticatedContext(STRANGER).firestore();

      await assertFails(getDoc(doc(db, path)));
    });

    it("should not let anyone else write it", async () => {
      const db = testEnv.authenticatedContext(STRANGER).firestore();

      await assertFails(setDoc(doc(db, path), { body: "他人の書き込み" }));
    });

    it("should not let a signed-out visitor read it", async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      await assertFails(getDoc(doc(db, path)));
    });

    it("should not let a signed-out visitor write it", async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      await assertFails(setDoc(doc(db, path), { body: "匿名未満の書き込み" }));
    });
  });

  it("should deny a path the rules never mention", async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();

    await assertFails(getDoc(doc(db, "decks/rider-waite")));
  });

  /**
   * LLM 整形の回数だけは、本人からも守る必要がある。
   *
   * 上限は請求額の歯止めなので、数えられている当人が 0 に戻せてはいけない。
   * `/users/{uid}` の下に置くと所有権ルールがそのまま通ってしまうため、
   * ルールを書かない場所（Admin SDK だけが触れる場所）に置いてある。
   * このアプリで「守る相手がいる」唯一のデータ。
   */
  describe("llmUsage", () => {
    const path = `llmUsage/${OWNER}`;

    it("should not let the person being counted read their own tally", async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();

      await assertFails(getDoc(doc(db, path)));
    });

    it("should not let the person being counted reset it", async () => {
      const db = testEnv.authenticatedContext(OWNER).firestore();

      await assertFails(setDoc(doc(db, path), { day: "2026-07-26", count: 0 }));
    });
  });
});
