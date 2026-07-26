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
[L4a] Template    [L4b] LLM
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
| `functions` | Cloud Functions v2、LLM 整形のみ。API キーを置ける唯一の場所 |

## コマンド

```bash
pnpm install
pnpm test                      # 全テスト
pnpm validate:decks            # デッキデータの整合性のみ
pnpm typecheck
pnpm demo:reading              # LLM なしでリーディングを1件生成して表示
pnpm demo:reading -- <seed>    # 同じ seed で再現

cp apps/web/.env.example apps/web/.env.local   # 初回のみ
pnpm emulators                 # Auth / Firestore / Functions（JDK が要る）
pnpm dev
pnpm test:firestore            # セキュリティルールと保存（エミュレータを自前で起動する）
pnpm build:functions           # Cloud Function を束ねる（デプロイ前に走る）
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
users/{uid}/journal/{readingId}          読みについて書いたもの（読み1つにつき1つ）
users/{uid}/journal/{autoId}             読みに紐づかない記入
```

ドキュメント ID をリーディングそのものから決めているので、同じ URL を開き直しても
履歴は増えない。**決定性がそのまま冪等性になっている。**

`drawn[]` や `deckIds` を別立てで持たない。どちらも `positions` と `meta` から導ける。
テンプレートの本文も保存しない。readingJson と辞書があれば必ず同じ文章が再生成できる
（0円・オフライン可）ので、保存する価値があるのは再生成できないもの、つまり
LLM の出力だけになる。カードデータを Firestore に置かないのと同じ判断。

```
llmUsage/{uid}                           1日あたりの整形回数（サーバー専用）
```

`llmUsage` だけは `users/` の外にある。ルールを書いていないので Admin SDK
以外は読み書きできない。本人の下に置くと自分で回数を 0 に戻せてしまい、
上限が飾りになる。**このアプリで「守る相手がいる」唯一のデータ。**

### LLM 整形（L4b）

`formatReading` は ReadingJSON を受け取り、構造化 JSON で本文を返す。
API キーはブラウザに置けないので、このプロジェクトでサーバーが要るのはここだけ。

プロンプトは**サーバー側で組み立てる**。素材を受け取って書くだけの関数にすると、
匿名でサインインできる誰もが有料モデルを汎用の文章生成器として使えてしまう。
ID をすべて辞書で引き直し、位置がスプレッドと一致することを確かめているので、
呼び出し側にできるのは「タロットの読み物を作らせること」だけになる。

モデルが書くのは本文だけで、カード名・位置名・スプレッド名は辞書のものを使う。
**モデルがカードを取り違えても、間違ったカード名は画面に出ない。**

```bash
# 秘密鍵はコンソールか CLI から。リポジトリには入らない。
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions        # Blaze プランが要る

# エミュレータで動かすときは環境変数で渡す
ANTHROPIC_API_KEY=sk-ant-... pnpm emulators
```

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
- **書くことを義務にしない。** 促さない、数えない、続けていることを褒めない。
  褒めた瞬間に書くことは習慣の達成になり、書きたくない日に書かないことが失敗になる。
  Journal の保存に失敗しても入力欄には手を触れない。通信の都合で消えてよい
  言葉は1文字も無い。
- **サインアップを求めない。** 匿名で黙って始め、あとから Google に繋げる。
  認証が失敗したときの行き先も「エラー画面」ではなく「保存のない状態」。
  読むことだけは最後まで続けられる、という不変条件はここでも同じ。
- **Firebase SDK を初期バンドルに載せない。** 動的 import 越しにのみ読み込む。
  静的に import すると `/` の First Load JS が 139kB → 292kB になり、
  保存を使わない人にも読み込みの重さだけを負わせることになる。
- **LLM に完成した文章を渡さない。** 渡すのは読み筋とキーワードまで。
  テンプレートの本文を渡すと LLM は言い換え装置になり、一貫性もコスト削減も失われる。
  `prompt.test.ts` がこの線を毎回踏んでいる。
- **プロンプトの文言も `packages/content` にしか置かない。** ただし辞書本体とは
  別の入口（`@tarot-mirror/content/prompt`）にしてある。モデルへの指示は
  サーバーしか読まないので、辞書に混ぜると全読者のバンドルに載る。
- **答えを一部だけ採用しない。** 位置がひとつ欠けても、トーンをひとつ外しても、
  丸ごとテンプレートに戻す。文体の違う本文が同じ画面に並ぶ読み物は、
  書き手が二人いるように読める。
- **本文は出す前に決める。** 整形を待つあいだ盤面は出すが本文は伏せ、時間切れなら
  テンプレートで確定して、あとから届いた答えは捨てる。読んでいる最中に文章が
  入れ替わるのは、読む側からすれば故障に見える。

## 開発の進め方

Issue 駆動。ブランチの切り方・commit 粒度・レビュー観点は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照。

CI は毎 PR で typecheck / test に加えて `demo:reading` を走らせる。
LLM なしで読み物が完成することが壊れていないかを、テストとは別に一目でわかる位置に置いている。

## 現状

Phase 1–8 完了（186 tests + エミュレータ 35 tests / typecheck clean）。次は Phase 9（LLM 整形）。
残作業は GitHub Issue に起票済み。実装計画は `~/.claude/plans/project-overview-md-ai-llm-tarot-mirror-tidy-parnas.md`。
