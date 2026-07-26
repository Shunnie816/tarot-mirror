import { readFileSync } from "node:fs";

import {
  type RulesTestEnvironment,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addJournalEntry,
  getJournalForReading,
  listJournalEntries,
  saveJournalForReading,
  updateJournalEntry,
} from "../../apps/web/src/lib/store/journal";

/**
 * テスト観点
 *
 *  1. 読みについて書いたものが読み戻せること（Issue #10「リーディングから書き始められる」）
 *  2. あとから直せること（「後から編集できる」）
 *  3. 直しても「いつ書きはじめたか」が動かないこと
 *  4. 空にすると消えること
 *  5. 読みに紐づかない記入もできること
 *  6. 一覧が書いた順であること
 *  7. 書いていない読みには何も無いこと（書かないことが異常でない）
 */

const PROJECT_ID = "demo-tarot-mirror-journal";
const UID = "writer-uid";
const READING_ID = "threeCards-journal-test";

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

describe("saveJournalForReading", () => {
  it("should keep what was written about a reading", async () => {
    await saveJournalForReading(db, UID, READING_ID, "手放すのが惜しいと思っている");

    const entry = await getJournalForReading(db, UID, READING_ID);

    expect(entry?.body).toBe("手放すのが惜しいと思っている");
    expect(entry?.readingId).toBe(READING_ID);
  });

  it("should let the writing be changed later", async () => {
    await saveJournalForReading(db, UID, READING_ID, "最初に書いたこと");

    await saveJournalForReading(db, UID, READING_ID, "あとから書き直したこと");

    const entry = await getJournalForReading(db, UID, READING_ID);
    expect(entry?.body).toBe("あとから書き直したこと");
  });

  it("should not move when the writing started, even after a rewrite", async () => {
    await saveJournalForReading(db, UID, READING_ID, "最初に書いたこと");
    const first = await getJournalForReading(db, UID, READING_ID);

    await saveJournalForReading(db, UID, READING_ID, "あとから書き直したこと");

    const second = await getJournalForReading(db, UID, READING_ID);
    expect(second?.createdAt).toEqual(first?.createdAt);
  });

  it("should remove the entry when it is emptied", async () => {
    await saveJournalForReading(db, UID, READING_ID, "書いたけれど消したいこと");

    await saveJournalForReading(db, UID, READING_ID, "   ");

    expect(await getJournalForReading(db, UID, READING_ID)).toBeNull();
  });
});

describe("getJournalForReading", () => {
  it("should report nothing for a reading that was never written about", async () => {
    expect(await getJournalForReading(db, UID, READING_ID)).toBeNull();
  });
});

describe("addJournalEntry", () => {
  it("should keep an entry that belongs to no reading", async () => {
    const id = await addJournalEntry(db, UID, "カードは引かずに書いたこと");

    const entries = await listJournalEntries(db, UID);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(id);
    expect(entries[0]).not.toHaveProperty("readingId");
  });

  it("should let a standalone entry be changed later", async () => {
    const id = await addJournalEntry(db, UID, "最初に書いたこと");

    await updateJournalEntry(db, UID, id, "あとから書き直したこと");

    const entries = await listJournalEntries(db, UID);
    expect(entries[0]?.body).toBe("あとから書き直したこと");
  });
});

describe("listJournalEntries", () => {
  it("should list what was written, newest first", async () => {
    await addJournalEntry(db, UID, "先に書いたこと");
    await addJournalEntry(db, UID, "あとで書いたこと");

    const entries = await listJournalEntries(db, UID);

    expect(entries.map((entry) => entry.body)).toEqual([
      "あとで書いたこと",
      "先に書いたこと",
    ]);
  });

  it("should report nothing when nothing has been written", async () => {
    expect(await listJournalEntries(db, UID)).toEqual([]);
  });
});
