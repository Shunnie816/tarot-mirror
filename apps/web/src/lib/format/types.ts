import type { FormatPort } from "@tarot-mirror/engine";

/**
 * 整形の呼び出し口。
 *
 * `null` を返すのは「呼べない」という意味で、失敗ではない。Firebase の設定値が
 * 無いとき、サインインしていないとき、Function を置いていないときが同じ扱いに
 * なる。どれもテンプレートで読める状態なので、画面上は区別がつかなくてよい。
 *
 * セッションと同じく非同期の生成にしている。ここで static import すると、
 * Firebase SDK が初期バンドルに戻ってきてしまう。
 */
export type CreateFormatPort = () => Promise<FormatPort | null>;

export type { FormatPort };
