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
| `apps/web` | Next.js（未着手 / Phase 7） |
| `functions` | Cloud Functions v2、LLM 整形のみ（未着手 / Phase 9） |

## コマンド

```bash
pnpm install
pnpm test                      # 全テスト
pnpm validate:decks            # デッキデータの整合性のみ
pnpm typecheck
pnpm demo:reading              # LLM なしでリーディングを1件生成して表示
pnpm demo:reading -- <seed>    # 同じ seed で再現
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

## 現状

Phase 1–6 完了（132 tests / typecheck clean）。次は Phase 7（`claude design` によるデザインシステムと Next.js UI）。
実装計画は `~/.claude/plans/project-overview-md-ai-llm-tarot-mirror-tidy-parnas.md`。
