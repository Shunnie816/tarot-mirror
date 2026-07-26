import { cookies } from "next/headers";

import { LLM_COOKIE, parseLlmPref } from "./llm";
import { REVERSALS_COOKIE, parseReversalsPref } from "./reversals";

/**
 * 設定をサーバーで読む。
 *
 * 引きを作る画面は2つある（盤面に置く `/draw` と読み物の `/reading`）。
 * 片方だけが設定を見ていると、盤面には逆位置のカードが並んでいるのに本文は
 * すべて正位置、という食い違いが出る。同じ場所から読ませて、ずれようが
 * ないようにしておく。
 */
export interface ReadingPrefs {
  /** 逆位置を使うか。切り替えても引くカードは変わらない。 */
  readonly allowReversals: boolean;
  /** LLM に言葉を整えてもらうか。 */
  readonly llmEnabled: boolean;
}

export async function readReadingPrefs(): Promise<ReadingPrefs> {
  const store = await cookies();

  return {
    allowReversals: parseReversalsPref(store.get(REVERSALS_COOKIE)?.value),
    llmEnabled: parseLlmPref(store.get(LLM_COOKIE)?.value),
  };
}
