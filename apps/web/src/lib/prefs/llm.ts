import { readFlag } from "./cookie";

/**
 * 「言葉を AI に整えてもらうか」。
 *
 * **既定はオフ。** 整形は1回ごとにお金がかかり、無いほうが速く、無くても
 * 読み物は完成する。既定を無料の経路にしておけば、その経路が毎日使われ続ける。
 */

export const LLM_COOKIE = "tm.llm";

export const LLM_ENABLED_BY_DEFAULT = false;

export function parseLlmPref(raw: string | undefined): boolean {
  return readFlag(raw, LLM_ENABLED_BY_DEFAULT);
}
