import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

import { formatReading as runFormat } from "./format.js";
import { createAnthropicClient, DEFAULT_MODEL } from "./model.js";
import { createFirestoreQuota } from "./quota.js";

/**
 * L4b — the only server this app has.
 *
 * It exists for one reason: an API key cannot live in a browser. Everything
 * else about a reading — drawing, interpreting, the cross-card rules, the
 * whole readable result — happens without it. If this function is down, the
 * app is not degraded in any way a user can be harmed by; it just renders from
 * the dictionary, as it does by default.
 *
 * Firestore's location is fixed at asia-northeast1 and cannot be changed, so
 * the function is pinned to the same region.
 */

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

/**
 * モデルは差し替えられる。ただし `defineString` は使わない。
 * 値の出どころが無いとエミュレータの起動時に対話プロンプトで止まってしまい、
 * 「動かして確かめる」がひとり分の手間になる。秘密ではないので環境変数で足りる。
 */
const model = () => process.env["LLM_MODEL"] ?? DEFAULT_MODEL;

initializeApp();

export const formatReading = onCall(
  {
    region: "asia-northeast1",
    secrets: [ANTHROPIC_API_KEY],
    // 整形は数秒で終わる。長く待たせるくらいならテンプレートに戻ったほうがいい。
    timeoutSeconds: 60,
    memory: "512MiB",
    // 常時起動は月額になる。読むたびの数百ミリ秒より、使わない日が0円のほうが大事。
    maxInstances: 5,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (uid === undefined) {
      throw new HttpsError("unauthenticated", "sign in first");
    }

    return runFormat(uid, request.data, {
      model: createAnthropicClient(ANTHROPIC_API_KEY.value(), model()),
      quota: createFirestoreQuota(getFirestore()),
      // 実測単価は推測できない。1リーディングあたりの入出力トークンを毎回残す。
      log: (entry) => logger.info("formatReading", entry),
      now: () => new Date(),
    });
  },
);
