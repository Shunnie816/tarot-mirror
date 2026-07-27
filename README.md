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
pnpm fetch:images              # カード画像を Wikimedia Commons から取得（通常は不要）

cp apps/web/.env.example apps/web/.env.local   # 初回のみ
pnpm emulators                 # Auth / Firestore / Functions（JDK が要る）
pnpm dev
pnpm test:firestore            # セキュリティルールと保存（エミュレータを自前で起動する）
pnpm build:functions           # Cloud Function を束ねる（deploy 時にも自動で走る）
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

### デプロイ

**main に入ったものは CI が本番へ出す**（`.github/workflows/ci.yml` の `deploy`）。
`verify` が通ってからでないと走らない。

| 対象 | 誰が出すか | いつ |
|---|---|---|
| 画面（App Hosting） | GitHub 連携 | main への push |
| Firestore ルールと索引 | CI | main への push（毎回） |
| Cloud Functions | CI | `functions/` `packages/` `firebase.json` `pnpm-lock.yaml` が変わったとき |

手で出すこともできる。

```bash
firebase deploy --only firestore        # ルールとインデックス
firebase deploy --only functions
```

#### なぜ自動化したか

**`firestore.rules` はリポジトリに置いてあることと、本番に載っていることが別。**
そして打つ機会が構造的に無い。App Hosting は main への push で勝手にロールアウト
するので、画面を出すために `firebase deploy` を打つ場面がそもそも存在しない。

v0.1 はこれで落ちた。ルールが一度も上がっておらず、本番はプロジェクト作成時の
ロックモード（既定拒否）のままだった。匿名サインインは成功するのに、自分の
`users/{uid}/readings` を読むたびに `PERMISSION_DENIED` が返り、**保存・履歴・
ジャーナルが丸ごと動いていなかった**（Issue #52）。

エミュレータのルールテスト（`pnpm test:firestore`）は `firestore.rules` を直接
読むので、**この抜けは原理的に踏めない**。CI が緑でも本番が拒否していることは
ありうる。だから手順書ではなく CI に持たせた（Issue #64）。

#### CI の認証（初回だけ必要な設定）

鍵ファイルは置かない。Workload Identity Federation で、このリポジトリの
ワークフローだけが本番に触れるようにする。

```bash
PROJECT=tarot-mirror-a74b6
NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
REPO=Shunnie816/tarot-mirror

# 1. デプロイ専用のサービスアカウント
gcloud iam service-accounts create github-deployer \
  --project=$PROJECT --display-name="GitHub Actions deployer"
SA=github-deployer@$PROJECT.iam.gserviceaccount.com

# 2. 権限。ルールと Function を出すのに要るぶんだけ
for ROLE in roles/firebaserules.admin roles/datastore.indexAdmin \
            roles/cloudfunctions.admin roles/artifactregistry.admin \
            roles/serviceusage.serviceUsageConsumer \
            roles/iam.serviceAccountUser roles/run.admin; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" --role="$ROLE" --condition=None
done

# 3. GitHub からの入口
gcloud iam workload-identity-pools create github --project=$PROJECT --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --project=$PROJECT --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"

# 4. このリポジトリにだけ、そのサービスアカウントを使わせる
gcloud iam service-accounts add-iam-policy-binding $SA --project=$PROJECT \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# 5. ワークフローに教える（秘密ではないので variable でよい）
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER \
  --body "projects/$NUMBER/locations/global/workloadIdentityPools/github/providers/github"
gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --body "$SA"
```

**`roles/iam.serviceAccountUser` を落とさないこと。** Function のデプロイは
実行用サービスアカウントを `actAs` する。これが無いと、npm でもビルドでもなく
`iam.serviceaccounts.actAs denied` で止まる（初回デプロイで踏んでいる）。
API を有効にした直後は IAM の反映が追いつかず、少し置いて再実行すると通る。

**`roles/firebaserules.admin` は索引をカバーしない。** ルールと索引は別の API で、
`firebase deploy --only firestore` は両方を出す。索引側は Firestore の API を
直接叩くので `roles/datastore.indexAdmin` が要る。これが無いと、ルールの
アップロードまで進んだあとに索引だけが 403 で落ちる。

```
✔  cloud.firestore: rules file firestore.rules compiled successfully
i  firestore: latest version of firestore.rules already up to date, skipping upload...
i  firestore: deploying indexes...
Error: ... /collectionGroups/-/indexes had HTTP Error: 403, The caller does not have permission
```

**ここで `--only firestore:rules` に逃げないこと。** 索引を出さない CI にすると、
`firestore.indexes.json` に索引を足した日から、また「リポジトリには在るのに本番に
無い」が始まる。#52 と同じ形なので、権限のほうを足す。

### 保存されるもの

```
users/{uid}/readings/{spreadId}-{seed}   ReadingJSON をそのまま + createdAt
users/{uid}/journal/{readingId}          読みについて書いたもの（読み1つにつき1つ）
users/{uid}/journal/{autoId}             読みに紐づかない記入
users/{uid}/renderings/{hash}            LLM が整えた本文（再生成できないもの）
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

整えた本文は `users/{uid}/renderings/{hash}` に残す。ReadingJSON は決定的なので、
履歴から同じ URL を開き直せば必ず当たり、二度目のトークンは買わない。
鍵に入れるのは**プロンプトに入るものだけ**で、`meta.drawnAt`（開き直すたびに変わる）
や `axes`（モデルに渡らない）は入れない。足りないと指示を変えたのに古い文章が
出続け、多すぎると同じ読み物なのに当たらない。

**整形はカードを置いているあいだに走らせる。** 3枚で5〜7秒、8枚だと18秒かかる（実測）ので、
読み物の手前で待つと本文を伏せたまま十数秒眺めさせることになり、文章が入れ替わるより悪い。
`/draw` はひと組ずつ押して置いていく作りで、**利用者が意図的にゆっくり進んでいる時間**が
すでにある。そこに重ねれば待ち時間はどこにも現れない。読み物の側は
「もう出来上がっているか」だけを短く見て、間に合っていなければ待たずにテンプレートで出す。

**既定はオフ。** `/settings` で切り替えると Cookie（`tm.llm`）に残る。

### 読み方の設定

| 設定 | Cookie | 既定 |
|---|---|---|
| 逆位置を使う | `tm.rev` | オン |
| 言葉を AI に整えてもらう | `tm.llm` | オフ |

localStorage ではなく Cookie にしてあるのは**サーバーが読めるから**。どちらの設定も
ページの最初の描画そのものを変える（整えるなら本文を伏せて待つ、逆位置が無いなら
盤面のカードの向きが違う）。サーバーが知らないと、描いたあとに画面が作り直される
ことになり、読む人には故障に見える。

```bash
# 秘密鍵はコンソールか CLI から。リポジトリには入らない。
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions        # Blaze プランが要る

# エミュレータで動かすときは環境変数で渡す
ANTHROPIC_API_KEY=sk-ant-... pnpm emulators
```

**`functions/package.json` にワークスペースのパッケージを書かないこと。** npm は
`workspace:*` を解釈できず、devDependencies に書いてあってもマニフェストを読んだ
時点で落ちる（Cloud Functions のビルドは npm で走る）。エンジンと辞書は esbuild が
束ねるので書く必要もない。解決は `build.mjs` / `functions/tsconfig.json` /
`vitest.workspace.ts` の3か所の別名で行っていて、書き忘れるとビルドが落ちる。
CI が `npm install --omit=dev` を毎回踏んでいる。

**predeploy に `pnpm --filter` を使わないこと。** firebase-tools は predeploy を
シェル越しに渡すので引数に引用符が付き、`pnpm --filter "@tarot-mirror/functions"` は
どのパッケージにも一致しない。しかも **pnpm は一致しなくても終了コード 0 を返す**ため、
ビルドが走らないまま古い成果物がデプロイされる。`node functions/build.mjs` は
自分の位置からパスを解決するので、どこから呼ばれても動く。

### 配信（App Hosting）

画面は Firebase App Hosting に載せている。Next.js の SSR がそのまま動き、
Auth / Firestore / Functions と同じプロジェクトに同居する。

```bash
firebase deploy --only apphosting        # ルールも Function も一緒なら firebase deploy
```

ただし通常このコマンドは打たない。バックエンドが GitHub と繋がっていて、
**main への push でロールアウトが走る**。裏を返すと `firebase deploy` を
打つ機会が無いということで、v0.1 でルールが本番に載っていなかった原因は
ここにあった。いまはルールと Function を CI が出すので、
手で打つ場面は基本的に無い（[デプロイ](#デプロイ)を参照）。

| 項目 | 値 |
|---|---|
| バックエンド | `tarot-mirror`（GitHub 連携。main への push でロールアウト） |
| URL | https://tarot-mirror--tarot-mirror-a74b6.asia-east1.hosted.app |
| ルートディレクトリ | `apps/web` |
| 設定 | [`apps/web/apphosting.yaml`](./apps/web/apphosting.yaml) |
| リージョン | `asia-east1` — **App Hosting に `asia-northeast1` は無い** |

Firestore と Function は `asia-northeast1` のまま。画面の配信リージョンだけが
違っていても困らない。整形の callable を叩くのはブラウザで、宛先のリージョンは
`lib/firebase/client.ts` が持っているからで、SSR サーバーは経由しない。

**`apphosting.yaml` はアプリのルートに置く。** リポジトリのルートではなく
`rootDir` が指す先（`apps/web`）。置き場所を間違えても deploy は成功し、
環境変数だけが黙って落ちる。

**`turbo.json` を消さないこと。** App Hosting が「モノレポ」と認識するのは
**`nx.json` か `turbo.json` がリポジトリのルートにある場合だけ**で、pnpm workspace は
それだけでは認識されない。無いと `apps/web` 自体がアプリのルートとして扱われ、
ルートにある `pnpm-lock.yaml` が一度も見られないまま `fah/missing-lock-file` で
落ちる（パッケージマネージャの判定も npm に落ちる）。ローカルの開発は今までどおり
`pnpm --filter` で回してよく、turbo を通るのは App Hosting のビルドだけ。

**`turbo.json` にコメントを書かないこと。** このファイルは2つの実装に読まれる。
turbo（Rust）は JSONC を受け付けるので `turbo run build` はローカルで通るが、
ビルドパック（Go）は `encoding/json` で読むので落ちる。CI が厳しいほうの
パーサを毎回踏んでいる。

**`next` はレンジではなく正確な版で書くこと。** ビルドパックは pnpm のロックファイルから
版を読めないと `package.json` の文字列にフォールバックし、それを `semver.satisfies` に
渡す。`satisfies` はバージョンを要求するので、レンジは中身が何であれ false になり、
「脆弱な Next」としてデプロイが止まる。**`^` を付けた時点で、値を上げても通らない。**
更新するときは `next` の実際の版を書き、CI がレンジでないことを踏む。

**`rootDir` の外も一緒に上がる。** App Hosting は `firebase.json` のある階層を
まるごと固めて上げるので `packages/*` は届く。`.gitignore` に書いてあるものは
自動で外れるため、`ignore` に足すのはそれ以外だけでいい。

**`pnpm install` はどこで走ってもワークスペース全体を見る。** `apps/web` の中から
呼んでも `pnpm-workspace.yaml` まで遡るので、`workspace:*` は解決される。
`functions/` で踏んだ npm の罠（`EUNSUPPORTEDPROTOCOL`）はここでは起きない。

**画面の本番ビルドは CI で毎回踏む。** dev サーバーでは通るのに `next build` で
落ちるものがあり、それを知るのがロールアウトの瞬間になるのは遅すぎる。

## カードの絵

1909年初版（ウェイト＝スミス版）のパブリックドメイン図版を、Wikimedia Commons の
スキャンから使わせてもらっている。**根拠と取得手順は [`docs/CARD_IMAGES.md`](./docs/CARD_IMAGES.md)。**

画像は `apps/web/public/cards/*.webp` にリポジトリごと入れてある。ビルド時に取りにいく
形にすると、Wikimedia が落ちている日にビルドが落ちる。

**絵が無くても読める。** 読み込みに失敗したら文字だけの盤面に戻るだけで、読み物は
最後まで完成する。カード名・位置名は辞書が持っていて、絵はそこに何も足していない。

## 設計上の判断メモ

- **`axes` に「良い/悪い」軸を作らない。** `friction` は「抵抗の大きさ」であって不幸ではない。
  この規律がないと L2 のルールは自然と吉凶判定に堕ちる。
- **逆位置は「意味の反転」ではない。** 内向化・保留・停滞として軸を一貫変換する
  （`applyReversal`）。78枚 × 2 の文言を個別に作り込まずに済む。
- **逆位置を外しても引くカードは変わらない。** `drawCards` は設定に関わらず向きの
  目を振る。振らずに済ませると乱数列がずれ、同じ seed が別の引きになる。
  設定は読み方の話であって、引きの話ではない。
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
- **絵はこちらの解釈を足さない。** カードの絵を出すのは、構図・視線・色・繰り返される
  小道具といった、こちらが言葉にしていない情報から利用者が自分で読み取れるようにするため。
  絵に説明を添えない。逆位置は絵ごと180°回す（文字は回さない — 読めなくなる）。
- **待ち時間は、利用者がすでに待っている場所に隠す。** 整形の実測は3枚で5〜7秒、
  8枚で18秒。読み物の手前で待たせるのではなく、カードを置いている最中に済ませる。
  無くせない時間は、消すのではなく重ねる。
- **LLM 整形の既定はオフ。** 1回ごとにお金がかかり、無いほうが速く、無くても
  読み物は完成する。既定を無料の経路にしておけば、その経路が毎日使われ続ける。
  「オフで全機能が動く」は節約機能である以上に回帰テストの入口。

## 開発の進め方

Issue 駆動。ブランチの切り方・commit 粒度・レビュー観点は [`CONTRIBUTING.md`](./CONTRIBUTING.md) を参照。

CI は毎 PR で typecheck / test に加えて `demo:reading` を走らせる。
LLM なしで読み物が完成することが壊れていないかを、テストとは別に一目でわかる位置に置いている。

## 現状

Phase 1–9 完了 + Issue #14/#21/#34/#36/#38/#40（274 tests + エミュレータ 37 tests / typecheck clean）。
`formatReading` は本番稼働中（`asia-northeast1` / `claude-haiku-4-5`、実測は3枚 $0.004〜0.006 / 8枚 $0.006〜0.016）。
残作業は GitHub Issue に起票済み。実装計画は `~/.claude/plans/project-overview-md-ai-llm-tarot-mirror-tidy-parnas.md`。
