/**
 * 保存先とのやりとりに失敗した理由を、開発者コンソールにだけ残す。
 *
 * 画面には出さない。利用者に見せるのは「いま読み込めませんでした」までで、
 * `permission-denied` のような語を読ませても、できることは何も増えない。
 *
 * ただし握りつぶすと、こちらも何も分からなくなる。v0.1 では Firestore の
 * ルールが本番に無く、匿名ユーザーが自分の記録を読むたびに 403 が返っていたが、
 * 画面上は「保存されない状態」と区別がつかず、機能が丸ごと未実装に見えていた
 * （Issue #52）。原因の一行がコンソールに出ていれば、その場で分かる話だった。
 */
export function reportStoreFailure(what: string, error: unknown): void {
  console.error(`[tarot-mirror] ${what}`, error);
}
