import type { Locale } from "@tarot-mirror/content";
import type { LlmFormatOutput, ReadingJSON } from "@tarot-mirror/engine";
import { httpsCallable } from "firebase/functions";

import { getFirebaseFunctions } from "@/lib/firebase/client";
import type { FormatPort } from "./types";

/**
 * Cloud Function 越しの整形。
 *
 * このファイルは動的 import 越しにのみ読み込む（`use-rendered-reading` 参照）。
 *
 * 関数が返す「できなかった」は、例外ではなく理由つきの答え。上限に達したのか、
 * トーンを外し続けたのか、モデルに届かなかったのかは、料金と品質を追うために
 * 区別したい。画面の側では全部同じ — テンプレートで読む — に潰れる。
 */

interface FormatRequest {
  readonly reading: ReadingJSON;
  readonly locale: Locale;
}

type FormatResponse =
  | { readonly ok: true; readonly output: LlmFormatOutput }
  | { readonly ok: false; readonly reason: string };

export function createCallablePort(): FormatPort {
  const call = httpsCallable<FormatRequest, FormatResponse>(
    getFirebaseFunctions(),
    "formatReading",
  );

  return {
    format: async (reading, locale) => {
      const response = await call({ reading, locale });
      return response.data.ok ? response.data.output : null;
    },
  };
}
