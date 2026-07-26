# カード画像の出典とライセンス

`apps/web/public/cards/*.webp` の78枚（＋裏面1枚）が何であり、なぜ配ってよいのか。

取得は `pnpm fetch:images`（`scripts/fetch-card-images.ts`）。取得したものはリポジトリに
入れてある。ビルド時に取りにいく形にすると、Wikimedia が落ちている日にビルドが落ちる。

## 使っているもの

| 項目 | 値 |
|---|---|
| 版 | **1909年 初版（Rider、通称 Roses & Lilies）** |
| 画 | Pamela Colman Smith（1878–1951） |
| 監修 | Arthur Edward Waite |
| スキャン | Saskia Jansen（個人所蔵の実物より） |
| 配布元 | [Wikimedia Commons — Category:Rider-Waite tarot deck (Roses & Lilies)](https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck_(Roses_%26_Lilies)) |
| ライセンス表示 | `{{PD-old-70-expired}}` — パブリックドメイン |
| 表示義務 | **無し**（Commons のメタデータ上も `AttributionRequired: false`） |

## なぜ配ってよいと判断したか

**図案そのもの。** Pamela Colman Smith は1951年没。著作権の保護期間（没後70年）は
2021年末に満了している。米国では1909年の刊行なので、1929年より前の刊行物として
すでに保護期間外。`PD-old-70-expired` はこの両方を満たすことを示すタグ。

**スキャン画像。** 平面の著作物を忠実に複製したものには新たな著作権が発生しない
（米国 Bridgeman v. Corel、および Wikimedia Commons がこの立場を全世界に適用している）。
スキャンした Saskia Jansen 自身も権利を主張していない。

**版を1909年初版に限定している理由。** 1971年に U.S. Games Systems が再彩色した版には
別の権利関係がある。Commons の「Rider-Waite tarot deck」カテゴリには後年の版や別物が
混ざっているため、取得スクリプトは **`(Roses & Lilies)` サブカテゴリのみ**を見ている。
ここを変えるときは、この文書も一緒に直すこと。

**取得のたびに確かめている。** スクリプトは1枚ごとに Commons のライセンス表示を読み、
`Public domain` でなければその場で止まる。取り直したら条件が変わっていた、が黙って
通ると、根拠の無い画像を配ることになる。

## 名前について

**画面では「ウェイト＝スミス版」と呼ぶ。**「Rider-Waite®」は U.S. Games Systems の
登録商標であり、こちらは同社の版を配っていない。加えて、絵を描いたのは Smith なので、
その名前が入る呼び方のほうが事実に近い（Wikimedia Commons もこの呼称を使っている）。

デッキ ID は既存データとの互換のため `rw` のまま。

## 表示

義務は無いが、描いた人の名前は画面に出す。`/settings` の末尾に一行置いてある
（`ui.creditsCards`）。

## 画像を使わない選択肢について

Issue #21 では「画像を使わず抽象表現にする案」も検討対象だった。Phase 7 のドロー画面は
実際に画像なしで完成していて、文字だけでも読める。

そのうえで画像ありを選んだのは、**スプレッド全体を見渡したときに、こちらが言葉にして
いない情報（構図・視線の向き・色・繰り返される小道具）から利用者が自分で解釈を広げられる**
ため。このアプリは意味を教える側ではなく、気づく材料を並べる側に立っている。絵は
その材料を増やす。

画像が無くても読めることは維持する。読み込みに失敗しても、文字だけの盤面に戻るだけで、
読み物は最後まで完成する。
