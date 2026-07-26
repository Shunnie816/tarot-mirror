import { createHash } from "node:crypto";

import type { Locale } from "@tarot-mirror/content";
import type { LlmFormatOutput, ReadingJSON } from "@tarot-mirror/engine";
import type { Firestore } from "firebase-admin/firestore";

/**
 * 同じリーディングに二度払わない。
 *
 * ReadingJSON は決定的なので、履歴から同じ URL を開き直せば同じ引きになる。
 * その読み物のために二度目のトークンを買う理由は無い。
 */

export interface RenderingCache {
  get(uid: string, key: string): Promise<LlmFormatOutput | null>;
  put(uid: string, key: string, output: LlmFormatOutput): Promise<void>;
}

export interface FingerprintInput {
  readonly reading: ReadingJSON;
  readonly locale: Locale;
  readonly promptVersion: number;
  readonly model: string;
}

/**
 * 鍵は「プロンプトに入るものすべて」で、それ以外は入れない。
 *
 * 足りないと、指示を書き換えたのに古い文章が出続ける。多すぎると、同じ読み物
 * なのに当たらない。とくに `meta.drawnAt` は開き直すたびに変わるので、これを
 * 混ぜた瞬間にキャッシュは一度も当たらなくなる。`axes` と `strength` も、
 * ルールが使うだけでモデルには渡らないので入れない。
 *
 * ここに項目を足すときの問いは「モデルの答えが変わるか」だけ。
 */
export function renderingKey(input: FingerprintInput): string {
  const { reading } = input;

  const material = JSON.stringify([
    input.promptVersion,
    input.locale,
    input.model,
    reading.spreadId,
    reading.seed,
    reading.question ?? "",
    reading.positions.map((position) => [
      position.positionId,
      position.cardId,
      position.orientation,
      position.lens,
      position.group ?? "",
      [...position.keywords],
    ]),
    reading.insights.map((insight) => [insight.id, [...insight.subjects]]),
    [...reading.reflection],
  ]);

  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

interface StoredRendering {
  readonly positions: readonly { positionId: string; text: string }[];
  readonly synthesis: string;
  readonly closingQuestion: string;
}

function isStored(value: unknown): value is StoredRendering {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record["positions"]) &&
    typeof record["synthesis"] === "string" &&
    typeof record["closingQuestion"] === "string"
  );
}

/**
 * 本人の下に置く。
 *
 * 中身はその人の読み物そのもので、他人と共有できるものではない。既定の
 * 所有権ルールがそのまま効くので、規則を足す必要も無い。上限の回数と違って、
 * 本人が壊せても困るのは本人だけ。
 */
export function createFirestoreCache(db: Firestore): RenderingCache {
  const ref = (uid: string, key: string) =>
    db.collection("users").doc(uid).collection("renderings").doc(key);

  return {
    get: async (uid, key) => {
      const snapshot = await ref(uid, key).get();
      const data = snapshot.data();
      if (!isStored(data)) return null;

      return {
        positions: data.positions.map((p) => ({
          positionId: String(p.positionId),
          text: String(p.text),
        })),
        synthesis: data.synthesis,
        closingQuestion: data.closingQuestion,
      };
    },

    put: async (uid, key, output) => {
      await ref(uid, key).set({
        positions: output.positions.map((p) => ({
          positionId: p.positionId,
          text: p.text,
        })),
        synthesis: output.synthesis,
        closingQuestion: output.closingQuestion,
        createdAt: new Date().toISOString(),
      });
    },
  };
}
