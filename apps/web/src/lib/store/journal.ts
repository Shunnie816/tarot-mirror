import {
  type DocumentData,
  type Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

/**
 * Journal — 読んだあとに自分の言葉で書くもの。
 *
 * リーディングに紐づく記入は、**読み1つにつき1つ**。ドキュメント ID に
 * readingId をそのまま使うので、索引も問い合わせも要らずに引ける。
 * 同じ読みについて何度も書くのではなく、書いたものを直していく形にしている。
 *
 * リーディングに紐づかない記入も許す。カードを引かなくても書きたいときはあるし、
 * 「書くには引かなければならない」という順序を作りたくない。
 */

export interface JournalEntry {
  readonly id: string;
  readonly body: string;
  /** どの読みについて書いたか。単独の記入では持たない。 */
  readonly readingId?: string;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export const JOURNAL_LIMIT = 50;

function journalRef(db: Firestore, uid: string) {
  return collection(db, "users", uid, "journal");
}

function toDate(value: unknown): Date | null {
  return value !== null &&
    typeof value === "object" &&
    value !== undefined &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
    ? ((value as { toDate: () => Date }).toDate())
    : null;
}

function toJournalEntry(id: string, data: DocumentData | undefined): JournalEntry | null {
  const body = data?.["body"];
  if (typeof body !== "string") return null;

  const readingId = data?.["readingId"];
  return {
    id,
    body,
    createdAt: toDate(data?.["createdAt"]),
    updatedAt: toDate(data?.["updatedAt"]),
    ...(typeof readingId === "string" ? { readingId } : {}),
  };
}

/**
 * 空にしたら消す。
 *
 * 書いたものを消したいときに「削除」を別に探させない。空の記入が一覧に
 * 残り続けるのも、書かなかったという事実の表現としては嘘になる。
 */
async function write(
  db: Firestore,
  uid: string,
  id: string,
  body: string,
  readingId?: string,
): Promise<void> {
  const ref = doc(journalRef(db, uid), id);

  if (body.trim() === "") {
    await deleteDoc(ref);
    return;
  }

  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      body,
      ...(readingId !== undefined ? { readingId } : {}),
      // 書き直しても「いつ書きはじめたか」は動かさない。
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** 読みに紐づく記入。ID は読みの ID そのもの。 */
export async function saveJournalForReading(
  db: Firestore,
  uid: string,
  readingId: string,
  body: string,
): Promise<void> {
  await write(db, uid, readingId, body, readingId);
}

export async function getJournalForReading(
  db: Firestore,
  uid: string,
  readingId: string,
): Promise<JournalEntry | null> {
  const snapshot = await getDoc(doc(journalRef(db, uid), readingId));
  if (!snapshot.exists()) return null;
  return toJournalEntry(snapshot.id, snapshot.data());
}

/** 単独の記入。新しい ID を採る。 */
export async function addJournalEntry(
  db: Firestore,
  uid: string,
  body: string,
): Promise<string> {
  const id = doc(journalRef(db, uid)).id;
  await write(db, uid, id, body);
  return id;
}

export async function updateJournalEntry(
  db: Firestore,
  uid: string,
  id: string,
  body: string,
): Promise<void> {
  await write(db, uid, id, body);
}

/**
 * 書いた順に新しいものから。
 *
 * 直した順ではない。古い記入を少し直しただけで一覧の先頭に来ると、
 * 書いたときの流れが読めなくなる。
 */
export async function listJournalEntries(
  db: Firestore,
  uid: string,
  count: number = JOURNAL_LIMIT,
): Promise<readonly JournalEntry[]> {
  const snapshot = await getDocs(
    query(journalRef(db, uid), orderBy("createdAt", "desc"), limitTo(count)),
  );

  return snapshot.docs
    .map((entry) => toJournalEntry(entry.id, entry.data()))
    .filter((entry): entry is JournalEntry => entry !== null);
}
