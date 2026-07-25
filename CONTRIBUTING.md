# 開発の進め方

Issue 駆動で進めます。**Issue のない変更はマージしない**（typo 修正を除く）。

## 流れ

```
Issue を立てる
   ↓  対応する Issue テンプレートを使う
ブランチを切る       feat/12-cups-cards / fix/34-reversal-clamp
   ↓
実装 + テスト        1つの責務ごとに commit
   ↓
PR                   本文に Closes #12
   ↓
CI green             typecheck / test / LLMなし通し
   ↓
Squash merge
```

ブランチ名は `<type>/<issue番号>-<短い説明>`。Issue 番号を入れておくと、後から
「なぜこの変更が必要だったか」に一手で戻れます。

## commit

Conventional Commits に従います。

```
feat:     新機能
fix:      バグ修正
refactor: リファクタリング
test:     テスト追加・修正
chore:    その他
docs:     ドキュメント
```

スコープはパッケージ名（`feat(engine):` / `feat(decks):` / `fix(content):`）。

**1 commit = 1 責務。** カードデータの追加とルールの修正を同じ commit に混ぜない。
commit 前に `pnpm test` と `pnpm typecheck` が通っていること。

## この設計で守るもの

コードレビューはこの5点を中心に見ます。README の「設計上の判断メモ」も併せて参照してください。

### 1. Rule Engine は日本語の文章を返さない

`kw.newBeginning` や `insight.mirroring.resonance` のような ID・関係・重みだけを返します。
ここで文章を返した瞬間に LLM は言い換え装置になり、一貫性もコスト削減も失われます。
文言は `packages/content` にしか存在しません。i18n が辞書追加だけで済むのもこの規律の副産物です。

### 2. LLM なしでリーディングが完成する

`TemplateRenderer` はフォールバックであると同時に無料プランの本体です。
`packages/engine/src/render/template.test.ts` が 300 通りのリーディングでこれを検証しています。
**このテストが落ちたらコスト戦略が壊れています。** 通すために期待値を緩めないでください。

### 3. 断定しない・吉凶を作らない

「必ず」「絶対に」「〜でしょう」といった断定は予言になります。
禁止表現は `packages/content/src/tone.ts` に一元化されていて、
UI コピー・TemplateRenderer・（将来の）LLM 出力検証の3箇所が同じリストを参照します。
トーンの判断で迷ったらこのファイルが正です。

`axes` にも「良い/悪い」の軸はありません。`friction` は抵抗の大きさであって不幸ではない。
この規律がないと、クロスカードルールは自然と吉凶判定に堕ちます。

### 4. ルールは反証されうること

特定のデッキやスプレッドで常に真になるルールは、観察に見せかけたノイズです。
大アルカナのみのデッキでは「大アルカナが50%以上」が全ての引きで真になり、何も言っていません
（`majorRatio` はこれを踏まえてデッキ構成を確認してから発火します）。
新しいルールを足すときは「どういう引きなら発火しないか」を先に書いてください。

### 5. 依存注入を使う

Rule Engine は純関数の集合なので、モックは原理的にほぼ不要です。
グローバルなカードレジストリを直接引かず、`interpretDraw(spread, drawn, lookup)` のように
依存を引数で受け取ってください。テストが合成デッキで書けるようになります。

## コマンド

```bash
pnpm install
pnpm test                      # 全テスト
pnpm test:watch
pnpm typecheck
pnpm validate:decks            # デッキデータの整合性のみ
pnpm demo:reading              # LLM なしでリーディングを1件生成
pnpm demo:reading <seed>       # 同じ seed で再現
```

`seed` があれば同じリーディングが必ず再現します。バグ報告には seed を添えてください。
