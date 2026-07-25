# Tarot Mirror

自己対話のためのアプリ。占いではなく、カードという象徴を使って自分の状態を整理するための道具。
コンセプトは [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) を参照。

## 設計の中心

> **Rule Engine は日本語の文章を出力しない。意味のID・関係・重みだけを出力する。**

Rule Engine が文章を吐くと、LLM は言い換え装置になり、一貫性もコスト削減も得られない。
記号レベル（`kw.newBeginning`、`insight.mirroring.resonance`）で出力するからこそ、
LLM の仕事は「与えられた意味だけを自然な日本語にする」という境界の明確な低難度タスクになる。

副次的な帰結として、i18n は辞書ファイルの追加だけで済み、LLM プロンプトも言語非依存になる。

```
Question ─┐
Spread   ─┤
          ▼
   [L0] Draw            seeded PRNG（再現可能）
          ▼
   [L1] Position 解釈    Card × Orientation × PositionLens
          ▼
   [L2] Cross-card ルール 宣言的ルール群
          ▼
   [L3] Synthesis       ランキング・重複統合・上限
          ▼
     ReadingJSON        ★ 全て純関数・全てID・コスト0
          ▼
  ┌───────┴────────┐
[L4a] Template    [L4b] LLM（未実装）
  辞書のみ・0円      Cloud Function → Claude
  常に動く           構造化JSON・検証・失敗時は L4a へ
```

**最重要の不変条件: LLM なしで完結した読み物が必ず生成できること。**
`template.test.ts` が 300 通りのリーディングでこれを毎回検証している。これが壊れたらコスト戦略も壊れる。

## パッケージ構成

| パッケージ | 役割 |
|---|---|
| `packages/content` | i18n 辞書とトークン。**文言はすべてここにしかない**。`tone.ts` の禁止表現リストは UI コピー・Template・LLM 検証の3箇所が共有する |
| `packages/decks` | カードデータ（静的JSON）と zod スキーマ。クライアントバンドルに載るため zod は実行時に走らせず、検証はテストで行う |
| `packages/engine` | Rule Engine 本体。DOM 非依存・外部依存なしの純TS |
| `apps/web` | Next.js (App Router)。デザインシステムと画面。Firebase に触れるのはセッションと保存だけ |
| `functions` | Cloud Functions v2、LLM 整形のみ（未着手 / Phase 9） |

## コマンド

```bash
pnpm install
pnpm test                      # 全テスト
pnpm validate:decks            # デッキデータの整合性のみ
pnpm typecheck
pnpm demo:reading              # LLM なしでリーディングを1件生成して表示
pnpm demo:reading -- <seed>    # 同じ seed で再現

cp apps/web/.env.example apps/web/.env.local   # 初回のみ
pnpm emulators                 # Auth / Firestore エミュレータ（JDK が要る）
pnpm dev
pnpm test:firestore            # セキュリティルールと保存（エミュレータを自前で起動する）
```

`pnpm test` はエミュレータも Java も要らない。実際に動かさないと確かめられないもの
（ルール・undefined の拒否・サーバー時刻）だけを `test:firestore` に分けてある。

## Firebase

| 項目 | 値 |
|---|---|
| プロジェクト | `tarot-mirror-a74b6` |
| Firestore リージョン | **`asia-northeast1`（確定・変更不可）** |

Firestore のロケーションは後から変更できないので、Cloud Functions のリージョンも
これに揃える。`(default)` データベースを Native モードで作成済み。

`.env.local` の設定値は秘密情報ではない。クライアントバンドルに載る公開識別子で、
データを守っているのは `firestore.rules` のほう。`NEXT_PUBLIC_FIREBASE_EMULATORS=1`
にするとエミュレータに繋がる。

**設定値が無くてもアプリは動く。** カードを引いて読むところまでは Firebase に
一切触れないため、その場合は保存だけが利用できない状態になる。

### 保存されるもの

```
users/{uid}/readings/{spreadId}-{seed}   ReadingJSON をそのまま + createdAt
users/{uid}/journal/{entryId}            未実装 / Phase 8 の #10
```

ドキュメント ID をリーディングそのものから決めているので、同じ URL を開き直しても
履歴は増えない。**決定性がそのまま冪等性になっている。**

`drawn[]` や `deckIds` を別立てで持たない。どちらも `positions` と `meta` から導ける。
テンプレートの本文も保存しない。readingJson と辞書があれば必ず同じ文章が再生成できる
（0円・オフライン可）ので、保存する価値があるのは再生成できないもの、つまり
Phase 9 の LLM 出力だけになる。カードデータを Firestore に置かないのと同じ判断。

## 設計上の判断メモ

- **`axes` に「良い/悪い」軸を作らない。** `friction` は「抵抗の大きさ」であって不幸ではない。
  この規律がないと L2 のルールは自然と吉凶判定に堕ちる。
- **逆位置は「意味の反転」ではない。** 内向化・保留・停滞として軸を一貫変換する
  （`applyReversal`）。78枚 × 2 の文言を個別に作り込まずに済む。
- **`majorRatio` はデッキ構成を見てから発火する。** 大アルカナのみのデッキでは
  「大アルカナが50%以上」は全ての引きで真になり、何も言っていないことになる。
- **Insight は上限4件。** トークン削減であると同時に、認知負荷の設計判断
  （Design Philosophy「slow down and think」）。
- **カードデータは Firestore に置かない。** 不変で全ユーザー共通なので、
  読み取り課金もオフライン非対応も受け入れる理由がない。
- **リーディングに保存ボタンを置かない。** 「気に入った引きだけ残す」形にすると
  履歴が選ばれたものに偏り、「同じカードが繰り返し出ている」ことに自分で気づけなくなる。
  気づきの材料にするには、偏りなく揃っている必要がある。
- **履歴で集計しない。** よく出るカードも、傾向も出さない。数えた瞬間に
  「当たり外れ」の語彙が入り込む。並べておく場所であって、読み解く場所ではない。
  気づくのは利用者の仕事で、こちらから「あなたはこういう傾向です」と言わない。
- **サインアップを求めない。** 匿名で黙って始め、あとから Google に繋げる。
  認証が失敗したときの行き先も「エラー画面」ではなく「保存のない状態」。
  読むことだけは最後まで続けられる、という不変条件はここでも同じ。
- **Firebase SDK を初期バンドルに載せない。** 動的 import 越しにのみ読み込む。
  静的に import すると `/` の First Load JS が 139kB → 292kB になり、
  保存を使わない人にも読み込みの重さだけを負わせることになる。

## 開発の進め方

Issue 駆動。ブランチの切り方・commit 粒度・レビュー観点は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照。

CI は毎 PR で typecheck / test に加えて `demo:reading` を走らせる。
LLM なしで読み物が完成することが壊れていないかを、テストとは別に一目でわかる位置に置いている。

## 現状

Phase 1–7 完了（148 tests / typecheck clean）。Phase 8（永続化）に着手中で、匿名 Auth まで完了。
残作業は GitHub Issue に起票済み。実装計画は `~/.claude/plans/project-overview-md-ai-llm-tarot-mirror-tidy-parnas.md`。
