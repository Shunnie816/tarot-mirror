import { expect, test } from "@playwright/test";

import { drawOneCard } from "./flow";

/**
 * テスト観点
 *
 *  1. 問い → 並べ方 → 置く → 読む が最後まで進めること
 *  2. 引いた読みが履歴に並ぶこと（Issue #52 の再発検知）
 *  3. 書きとめたものが、開き直しても残っていること
 *  4. 保存が使えない状態でも、引いて読み終えられること
 *
 * 4 がこのプロジェクトの中心的な不変条件。カードを引いて読むところまでは
 * Firebase に一切触れない、という設計がここで初めて画面越しに確かめられる。
 */

test.describe("引いて読む", () => {
  test("should carry the reader from a question all the way to a reading", async ({
    page,
  }) => {
    await drawOneCard(page, "いま何を手放すべきか");

    // 問いは、書いたそのままの形で読み物に残る。
    await expect(page.getByText("いま何を手放すべきか")).toBeVisible();

    // 段階開示を最後まで開ける。開き切ると締めの言葉に届く。
    const reveal = page.getByRole("button", {
      name: /ひらく$|全体をとおして読む|締めの言葉を読む/,
    });
    while ((await reveal.count()) > 0) {
      await reveal.first().click();
    }

    await expect(
      page.getByText("ここに書かれていることは、決まった答えではありません", {
        exact: false,
      }),
    ).toBeVisible();
  });

  // Issue #52 そのもの。単体テストもルールテストも緑のまま、ここだけが
  // 死んでいた。保存の成否が画面に出るところまでを見る。
  test("should keep the reading so it shows up in the history", async ({
    page,
  }) => {
    await drawOneCard(page, "履歴に残るか");

    await expect(page.getByText("この読みは残してあります。")).toBeVisible();

    await page.goto("/history");

    const entry = page.locator(".history-entry").filter({ hasText: "履歴に残るか" });
    await expect(entry).toHaveCount(1);

    // 履歴から開くと、同じ読みに戻れる。
    await entry.getByRole("link").first().click();
    await expect(page).toHaveURL(/spread=oneCard/);
    await expect(page.getByText("履歴に残るか")).toBeVisible();
  });

  test("should still have what was written after coming back", async ({
    page,
  }) => {
    await drawOneCard(page, "書いたものが残るか");
    const url = page.url();

    const editor = page.getByLabel("読んでみて、思ったこと");
    await editor.fill("あとで読み返したい言葉");
    await page.getByRole("button", { name: "書きとめる" }).click();
    await expect(page.getByText("書きとめました。")).toBeVisible();

    // 開き直す。書いたものは読み込まれて出てくる。
    await page.goto(url);
    await expect(page.getByLabel("読んでみて、思ったこと")).toHaveValue(
      "あとで読み返したい言葉",
    );
  });
});

/**
 * このアプリの中心的な不変条件。
 *
 * カードを引いて読むところまでは Firebase に一切触れない設計なので、
 * サインインできなくても読み物は最後まで完成する。認証を落として確かめる。
 */
test.describe("保存が使えないとき", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.route("**/127.0.0.1:9099/**", (route) => route.abort());
  });

  test("should still let the reader draw and finish reading", async ({
    page,
  }) => {
    await drawOneCard(page, "サインインできなくても読めるか");

    await expect(page.getByText("サインインできなくても読めるか")).toBeVisible();

    const reveal = page.getByRole("button", {
      name: /ひらく$|全体をとおして読む|締めの言葉を読む/,
    });
    while ((await reveal.count()) > 0) {
      await reveal.first().click();
    }

    await expect(
      page.getByText("ここに書かれていることは、決まった答えではありません", {
        exact: false,
      }),
    ).toBeVisible();
  });

  // 保存できない場所で入力欄を出すのは罠なので、畳んで理由を出す。
  test("should say plainly that nothing can be kept", async ({ page }) => {
    await drawOneCard(page);

    await expect(
      page.getByText("いまは書いたものを残せない状態です。"),
    ).toBeVisible();
  });
});
