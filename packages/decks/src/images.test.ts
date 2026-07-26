import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { riderWaite } from "./index.js";

/**
 * カードデータと画像がずれていないことを確かめる。
 *
 * 画像はネットワーク越しに取ってきて手元に置いてあるので、デッキに1枚足したのに
 * 取り直すのを忘れる、という食い違いが起こりうる。取得スクリプトは黙って
 * 「取得済みは飛ばす」ので、忘れたことに気づく場所がここしか無い。
 *
 * 出典とライセンスの根拠は `docs/CARD_IMAGES.md`。
 */

const imagesDir = path.resolve(
  fileURLToPath(new URL("../../../apps/web/public/cards", import.meta.url)),
);

const imageFor = (cardId: string) => path.join(imagesDir, `${cardId}.webp`);

describe("card images", () => {
  it("should have one image per card in the deck", () => {
    const missing = riderWaite.cards
      .map((card) => card.id)
      .filter((id) => !existsSync(imageFor(id)));

    expect(missing).toEqual([]);
  });

  /** 伏せているあいだの盤面に置く。 */
  it("should have the deck's back", () => {
    expect(existsSync(path.join(imagesDir, "back.webp"))).toBe(true);
  });
});
