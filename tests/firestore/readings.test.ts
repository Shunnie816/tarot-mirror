import { readFileSync } from "node:fs";

import {
  type RulesTestEnvironment,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { riderWaite } from "@tarot-mirror/decks";
import { createReading, getSpread } from "@tarot-mirror/engine";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getReading, saveReading } from "../../apps/web/src/lib/store/readings";

/**
 * テスト観点
 *
 *  1. 保存したリーディングが、そのまま読み戻せること
 *  2. 同じリーディングを二度開いても履歴が増えないこと
 *  3. 二度目に「いつ引いたか」が書き換わらないこと
 *  4. 任意項目（question / group）の有無で保存が落ちないこと
 *     — Firestore は undefined を受け付けないので、ここは実物で踏む必要がある
 *  5. 無いものを読もうとしても壊れないこと
 *
 * 純関数の検証は `reading-doc.test.ts` にある。こちらは実際の Firestore に
 * 通したときにだけ出る失敗（undefined の拒否・サーバー時刻・冪等性）を見る。
 */

// `rules.test.ts` と別のプロジェクトにして、並行に走っても互いの土台を
// 消し合わないようにする。`demo-` 始まりは本番に触れない名前空間。
const PROJECT_ID = "demo-tarot-mirror-readings";
const UID = "reader-uid";

const withQuestion = createReading({
  spread: getSpread("threeCards"),
  deck: riderWaite,
  seed: "store-test",
  question: "いま何を手放すべきか",
});

const withoutQuestion = createReading({
  spread: getSpread("oneCard"),
  deck: riderWaite,
  seed: "store-test",
});

/** group を持つ唯一のスプレッド。 */
const withSides = createReading({
  spread: getSpread("relationship8"),
  deck: riderWaite,
  seed: "store-test",
});

let testEnv: RulesTestEnvironment;
let db: Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  db = testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("saveReading", () => {
  it("should store a reading that can be read back unchanged", async () => {
    await saveReading(db, UID, withQuestion);

    const stored = await getReading(db, UID, "threeCards-store-test");

    expect(stored?.reading).toEqual(withQuestion);
  });

  it("should store a reading that has no question", async () => {
    await saveReading(db, UID, withoutQuestion);

    const stored = await getReading(db, UID, "oneCard-store-test");

    expect(stored?.reading).toEqual(withoutQuestion);
  });

  it("should store a reading whose positions belong to sides", async () => {
    await saveReading(db, UID, withSides);

    const stored = await getReading(db, UID, "relationship8-store-test");

    expect(stored?.reading).toEqual(withSides);
  });

  it("should record when the reading was kept", async () => {
    await saveReading(db, UID, withQuestion);

    const stored = await getReading(db, UID, "threeCards-store-test");

    expect(stored?.createdAt).toBeInstanceOf(Date);
  });

  it("should not keep a second copy when the same reading is opened again", async () => {
    await saveReading(db, UID, withQuestion);

    const outcome = await saveReading(db, UID, withQuestion);

    expect(outcome).toBe("alreadySaved");
  });

  it("should leave the original time alone when the reading is opened again", async () => {
    await saveReading(db, UID, withQuestion);
    const first = await getReading(db, UID, "threeCards-store-test");

    await saveReading(db, UID, withQuestion);
    const second = await getReading(db, UID, "threeCards-store-test");

    expect(second?.createdAt).toEqual(first?.createdAt);
  });
});

describe("getReading", () => {
  it("should report nothing for a reading that was never kept", async () => {
    expect(await getReading(db, UID, "threeCards-never-drawn")).toBeNull();
  });
});
