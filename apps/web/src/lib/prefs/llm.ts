/**
 * 「言葉を AI に整えてもらうか」の設定。
 *
 * Cookie に置く。localStorage ではない理由は一つで、**サーバーが読めるから**。
 * この設定はページの最初の描画そのものを変える（整えるなら本文を伏せて待ち、
 * 整えないならすぐ出す）。サーバーが知らないと、既定の無料経路にまで
 * 「待っている」画面を挟むか、整える経路で本文が一瞬出てから消えるかの
 * どちらかになる。どちらも読む人には故障に見える。
 *
 * 端末ごとの設定でいい。アカウントに紐づける必要が出てくるのは、
 * 端末をまたいで揃えたくなったときで、いまはその話ではない。
 *
 * **既定はオフ。** 整形は1回ごとにお金がかかり、無いほうが速く、無くても
 * 読み物は完成する。既定を無料の経路にしておけば、その経路が毎日使われ続ける。
 */

export const LLM_COOKIE = "tm.llm";

/** 1年。設定を選び直させる理由が無い。 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const LLM_ENABLED_BY_DEFAULT = false;

/**
 * Cookie の値を読む。読めないものは既定に倒す。
 *
 * 壊れた値で例外を投げない。設定が読めないことは、読み物が読めない理由に
 * ならない。
 */
export function parseLlmPref(raw: string | undefined): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return LLM_ENABLED_BY_DEFAULT;
}

/** `document.cookie` にそのまま入れられる形。 */
export function serializeLlmPref(enabled: boolean): string {
  return `${LLM_COOKIE}=${enabled ? "1" : "0"}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
