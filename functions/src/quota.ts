import type { Firestore } from "firebase-admin/firestore";

/**
 * A ceiling on what one account can spend.
 *
 * Anonymous sign-in means an account costs nothing to create, and this
 * endpoint costs real money to call. Without a cap the bill is bounded only by
 * someone's patience. The cap is deliberately far above ordinary use: nobody
 * doing self-reflection draws thirty spreads in a day, and the person who hits
 * it is not the person this app is for.
 *
 * The counter lives in a top-level collection with no security rule, so it is
 * reachable by the Admin SDK only. Under `users/{uid}` the owner could reset
 * their own counter, which would make it decoration.
 */

export const DAILY_LIMIT = 30;

const COLLECTION = "llmUsage";

export interface QuotaStore {
  /** Returns false when the caller has already used today's allowance. */
  consume(uid: string, day: string): Promise<boolean>;
}

export interface Usage {
  readonly day: string;
  readonly count: number;
}

/** UTC, not local: the reset has to be somewhere, and somewhere arbitrary is fine. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Decide the next counter value. Pure, so the rollover and the ceiling can be
 * tested without a database.
 */
export function nextUsage(
  current: Usage | null,
  day: string,
  limit: number,
): Usage | null {
  if (current === null || current.day !== day) return { day, count: 1 };
  if (current.count >= limit) return null;
  return { day, count: current.count + 1 };
}

export function createFirestoreQuota(
  db: Firestore,
  limit: number = DAILY_LIMIT,
): QuotaStore {
  return {
    consume: async (uid, day) => {
      const ref = db.collection(COLLECTION).doc(uid);

      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const data = snapshot.data();
        const current =
          typeof data?.["day"] === "string" && typeof data["count"] === "number"
            ? { day: data["day"], count: data["count"] }
            : null;

        const next = nextUsage(current, day, limit);
        if (next === null) return false;

        tx.set(ref, next);
        return true;
      });
    },
  };
}
