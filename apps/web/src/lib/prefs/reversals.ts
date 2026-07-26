import { readFlag } from "./cookie";

/**
 * 「逆位置を使うか」。
 *
 * **既定はオン。** 逆位置はこのアプリの読み方の中心にある（意味の反転ではなく
 * 内向き・保留・停滞として軸を一貫変換する）ので、既定で外すと読み物が
 * 平板になる。それでも外せるようにするのは、逆位置を落ち込む材料として
 * 受け取ってしまう人がいるからで、そうなるとこのアプリの目的に反する。
 *
 * 切り替えても**引くカードは変わらない**（`drawCards` は設定に関わらず
 * 向きの目を振る）。同じ seed が同じ引きを再現する、という約束は
 * 設定をまたいでも保たれる。
 */

export const REVERSALS_COOKIE = "tm.rev";

export const REVERSALS_ENABLED_BY_DEFAULT = true;

export function parseReversalsPref(raw: string | undefined): boolean {
  return readFlag(raw, REVERSALS_ENABLED_BY_DEFAULT);
}
