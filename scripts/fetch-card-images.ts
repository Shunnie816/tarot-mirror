/**
 * Fetch the card images from Wikimedia Commons.
 *
 *   pnpm fetch:images          # 足りないものだけ取る
 *   pnpm fetch:images --force  # 全部取り直す
 *
 * 出力は `apps/web/public/cards/<cardId>.webp`。取ったものはリポジトリに入れる。
 * ビルド時に取りにいく形にすると、Commons が落ちている日にビルドが落ちる。
 * 画像は不変なので、一度取れば取り直す理由も無い。
 *
 * 出典とライセンスの根拠は `docs/CARD_IMAGES.md`。このスクリプトが取ってくる
 * 先を変えるときは、あちらも一緒に直すこと。
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { riderWaite } from "@tarot-mirror/decks";
import sharp from "sharp";

const API = "https://commons.wikimedia.org/w/api.php";

/**
 * 1909年の初版（Roses & Lilies）だけを集めたカテゴリ。
 *
 * 「Rider-Waite tarot deck」の側には後年の版や別物が混ざっている。
 * 1971年の再彩色版には別の権利関係があるので、初版に限定する。
 */
const CATEGORY = "Category:Rider-Waite tarot deck (Roses & Lilies)";

/**
 * 盤面のタイルは CSS で 110〜160px ほど。高解像度の画面でも足りる 320px にする。
 *
 * 1909年のスキャンは紙の質感と経年の粒子が乗っていて、WebP がうまく縮まない。
 * 480px にすると78枚で 10MB を超え、盤面に出す絵としては見合わない。
 * もっと大きく見せる画面を作るときは `--force` で取り直す。
 */
const WIDTH = 320;
const QUALITY = 72;

const USER_AGENT =
  "tarot-mirror/0.0 (https://github.com/Shunnie816/tarot-mirror)";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = path.join(root, "apps", "web", "public", "cards");

const SUITS = ["wands", "cups", "swords", "pentacles"] as const;
/** Commons 側は宮廷札も数字で並んでいる。11=Page, 12=Knight, 13=Queen, 14=King。 */
const COURT_NUMBERS: Readonly<Record<string, string>> = {
  page: "11",
  knight: "12",
  queen: "13",
  king: "14",
};

const capitalise = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/**
 * カードIDから Commons のファイル名を組み立てる。
 *
 * 大アルカナだけは番号だけでは決まらない（`00 Fool` のように名前が付く）ので、
 * カテゴリの実際の一覧と番号で突き合わせる。名前を手で書き写すと、綴りを
 * 間違えたときに黙って1枚だけ落ちる。
 */
function commonsTitle(
  cardId: string,
  majorsByNumber: ReadonlyMap<string, string>,
): string {
  const [, group, rank] = cardId.split(".");
  if (group === undefined || rank === undefined) {
    throw new Error(`Cannot read card id "${cardId}"`);
  }

  if (group === "major") {
    const title = majorsByNumber.get(rank);
    if (title === undefined) {
      throw new Error(`No Commons file for major arcana ${rank}`);
    }
    return title;
  }

  if (!SUITS.includes(group as (typeof SUITS)[number])) {
    throw new Error(`Unknown suit "${group}" in "${cardId}"`);
  }

  const number = COURT_NUMBERS[rank] ?? rank;
  return `File:RWS1909 - ${capitalise(group)} ${number}.jpeg`;
}

async function api(params: Record<string, string>): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ ...params, format: "json" })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Commons API ${response.status} for ${params["titles"] ?? params["cmtitle"]}`);
  }
  return response.json();
}

async function listCategory(): Promise<string[]> {
  const data = (await api({
    action: "query",
    list: "categorymembers",
    cmtitle: CATEGORY,
    cmlimit: "500",
    cmtype: "file",
  })) as { query: { categorymembers: { title: string }[] } };

  return data.query.categorymembers.map((member) => member.title);
}

interface RemoteImage {
  readonly url: string;
  readonly license: string;
}

/** Commons 側でリサイズしてもらう。原寸を78枚落としてくる理由が無い。 */
async function describe(title: string): Promise<RemoteImage> {
  const data = (await api({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(WIDTH),
    titles: title,
  })) as {
    query: {
      pages: Record<
        string,
        {
          missing?: string;
          imageinfo?: {
            thumburl?: string;
            url: string;
            extmetadata?: { LicenseShortName?: { value: string } };
          }[];
        }
      >;
    };
  };

  const page = Object.values(data.query.pages)[0];
  if (page === undefined || page.missing !== undefined || !page.imageinfo?.[0]) {
    throw new Error(`Commons has no file "${title}"`);
  }

  const info = page.imageinfo[0];
  return {
    url: info.thumburl ?? info.url,
    license: info.extmetadata?.LicenseShortName?.value ?? "unknown",
  };
}

/**
 * ライセンスが変わっていないことを毎回確かめる。
 *
 * 取り直したら別の条件になっていた、が黙って通ると、根拠の無い画像を
 * 配ることになる。
 */
function assertPublicDomain(title: string, license: string): void {
  if (!/public domain/i.test(license)) {
    throw new Error(
      `"${title}" is no longer marked public domain on Commons (got "${license}"). ` +
        `Stop and re-check docs/CARD_IMAGES.md before shipping it.`,
    );
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Commons は連続した取得を 429 で断る。
 *
 * 78枚を一息に取りにいくのは無料で貸してもらっている側の作法ではないので、
 * 一定の間隔を空け、断られたら待って出直す。取得済みは飛ばすので、
 * 途中で止まっても続きから再開できる。
 */
const PAUSE_MS = 400;
const RETRIES = 4;

async function fetchWithBackoff(url: string): Promise<Response> {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response;
    if (response.status !== 429 || attempt === RETRIES) {
      throw new Error(`Download ${response.status} for ${url}`);
    }
    const wait = 2000 * 2 ** attempt;
    process.stdout.write(`  ...429, waiting ${wait / 1000}s\n`);
    await sleep(wait);
  }
  throw new Error(`unreachable`);
}

async function save(image: RemoteImage, target: string): Promise<number> {
  const response = await fetchWithBackoff(image.url);

  const webp = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  await writeFile(target, webp);
  return webp.byteLength;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  await mkdir(outDir, { recursive: true });

  const category = await listCategory();
  const majorsByNumber = new Map(
    category
      .map((title) => /^File:RWS1909 - (\d{2}) /.exec(title))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => [match[1]!, match.input]),
  );

  const wanted: [string, string][] = riderWaite.cards.map((card) => [
    card.id,
    commonsTitle(card.id, majorsByNumber),
  ]);
  // 裏面。伏せられているあいだの盤面に置く。
  wanted.push(["back", "File:Waite–Smith Tarot Roses and Lilies cropped.jpg"]);

  let written = 0;
  let bytes = 0;
  let skipped = 0;

  for (const [name, title] of wanted) {
    const target = path.join(outDir, `${name}.webp`);
    if (!force && existsSync(target)) {
      skipped += 1;
      continue;
    }

    const image = await describe(title);
    assertPublicDomain(title, image.license);
    bytes += await save(image, target);
    written += 1;
    process.stdout.write(`  ${name} ← ${title.replace("File:", "")}\n`);
    await sleep(PAUSE_MS);
  }

  console.log(
    `\n${written} written (${(bytes / 1024 / 1024).toFixed(2)} MB), ${skipped} already there.`,
  );
  console.log(`→ ${path.relative(root, outDir)}`);
}

// トップレベル await は使わない（このリポジトリのスクリプトは CJS として走る）。
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
