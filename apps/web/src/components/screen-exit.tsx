import { getResolver, type Locale } from "@tarot-mirror/content";
import Link from "next/link";

/**
 * 画面から出る道。
 *
 * 共通のヘッダーを常設しない代わりに、各画面の末尾に置く。読んでいる最中に
 * 「次」を視界へ入れたくないので、出会うのは読み終わってからにする。
 * MVP を使ってもらったとき、ここが無いせいでブラウザの戻るボタン以外に
 * 出口が無かった（Issue #53）。
 *
 * 並べるのは多くて2つ。3つ以上になった時点でメニューになり、
 * 「どこかへ行くこと」自体が画面の用件に見えはじめる。
 */
export function ScreenExit({
  locale,
  reading = false,
  also,
}: {
  readonly locale: Locale;
  /** 読み物の幅に合わせる。読み物の下に置くときだけ。 */
  readonly reading?: boolean;
  /** 「はじめに戻る」のあとに1つだけ足せる。 */
  readonly also?: { readonly href: string; readonly labelId: `ui.${string}` };
}) {
  const resolver = getResolver(locale);

  return (
    <nav
      className={`screen-exit${reading ? " screen-exit--reading" : ""}`}
      aria-label={resolver.ui("ui.exitLabel")}
    >
      <Link href="/" className="quiet-link">
        {resolver.ui("ui.exitHome")}
      </Link>

      {also !== undefined && (
        <Link href={also.href} className="quiet-link">
          {resolver.ui(also.labelId)}
        </Link>
      )}
    </nav>
  );
}
