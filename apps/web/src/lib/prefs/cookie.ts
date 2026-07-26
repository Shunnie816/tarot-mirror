/**
 * 読み方の設定を Cookie に置く仕組み。
 *
 * localStorage ではない理由は一つで、**サーバーが読めるから**。設定はどれも
 * ページの最初の描画そのものを変える（整えるなら本文を伏せて待つ、逆位置が
 * 無いなら盤面のカードの向きが違う）。サーバーが知らないと、描いたあとに
 * 画面が作り直されることになり、読む人には故障に見える。
 *
 * 端末ごとの設定でいい。アカウントに紐づける必要が出てくるのは端末をまたいで
 * 揃えたくなったときで、いまはその話ではない。
 */

/** 1年。設定を選び直させる理由が無い。 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie の値を読む。読めないものは既定に倒す。
 *
 * 壊れた値で例外を投げない。設定が読めないことは、読み物が読めない理由に
 * ならない。
 */
export function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

/** `document.cookie` にそのまま入れられる形。 */
export function serializeFlag(name: string, enabled: boolean): string {
  return `${name}=${enabled ? "1" : "0"}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
