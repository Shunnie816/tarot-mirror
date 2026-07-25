import type { ReadingJSON } from "@tarot-mirror/engine";
import {
  type DocumentData,
  type Firestore,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { fromReadingDoc, readingDocId, toReadingDoc } from "./reading-doc";

/**
 * リーディングの保存。
 *
 * 依存は引数で受け取る。Firestore をモジュール直下で掴むと、エミュレータに
 * 繋いだ実物での検証ができなくなる。
 */

export type SaveOutcome = "saved" | "alreadySaved";

export interface StoredReading {
  readonly id: string;
  readonly reading: ReadingJSON;
  /** サーバー時刻。書き込み直後の手元の写しではまだ確定していないので null になりうる。 */
  readonly createdAt: Date | null;
}

function readingsRef(db: Firestore, uid: string) {
  return collection(db, "users", uid, "readings");
}

/**
 * まだ無いときだけ書く。
 *
 * 同じ URL を開き直すたびに書き直すと、`createdAt` が更新されて履歴の並びが
 * 動く。「いつ引いたか」は最初の一度きりの事実なので、上書きしない。
 * 読み直しは1回の読み取りで済み、書き込みは発生しない。
 */
export async function saveReading(
  db: Firestore,
  uid: string,
  reading: ReadingJSON,
): Promise<SaveOutcome> {
  const ref = doc(readingsRef(db, uid), readingDocId(reading));

  const existing = await getDoc(ref);
  if (existing.exists()) return "alreadySaved";

  await setDoc(ref, {
    ...toReadingDoc(reading),
    // 手元の時計ではなくサーバー時刻。履歴の並びの基準になる。
    createdAt: serverTimestamp(),
  });
  return "saved";
}

/** ドキュメント1件を、読める形に起こす。読めなければ null。 */
export function toStoredReading(
  id: string,
  data: DocumentData | undefined,
): StoredReading | null {
  const reading = fromReadingDoc(data);
  if (reading === null) return null;

  const createdAt = data?.["createdAt"];
  return {
    id,
    reading,
    createdAt:
      createdAt !== null &&
      typeof createdAt === "object" &&
      "toDate" in createdAt &&
      typeof createdAt.toDate === "function"
        ? (createdAt.toDate() as Date)
        : null,
  };
}

export async function getReading(
  db: Firestore,
  uid: string,
  id: string,
): Promise<StoredReading | null> {
  const snapshot = await getDoc(doc(readingsRef(db, uid), id));
  if (!snapshot.exists()) return null;
  return toStoredReading(snapshot.id, snapshot.data());
}
