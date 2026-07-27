import { expect, type Page } from "@playwright/test";

/**
 * 画面をまたぐ道のり。複数の spec が同じ道を通るので、ここに置く。
 *
 * 文言は `packages/content/src/ja/ui.json` のもの。辞書を書き換えたらここも
 * 落ちるが、それは正しい。利用者が押すものの名前が変わったということなので。
 */

/** 一枚引きで、置いて、読み物にたどり着くまで。 */
export async function drawOneCard(
  page: Page,
  question?: string,
): Promise<void> {
  await page.goto("/");

  if (question !== undefined) {
    await page.getByLabel("あなたの問い（任意）").fill(question);
    await page.getByRole("button", { name: "この問いで進む" }).click();
  } else {
    await page.getByRole("button", { name: "問いを書かずに進む" }).click();
  }

  await expect(page).toHaveURL(/\/spread/);

  // 「いま一枚」の並べ方を選ぶ。スプレッドごとに同じ名前のボタンが並ぶので、
  // 見出しから辿って、その組のボタンを押す。
  const oneCard = page.locator(".spread-option").filter({ hasText: "いま一枚" });
  await oneCard.getByRole("button", { name: "この並べ方にする" }).click();

  await expect(page).toHaveURL(/\/draw/);

  // ひと組ずつ置く。押せるあいだ押し続ける。
  const place = page.getByRole("button", { name: /置く$/ });
  while ((await place.count()) > 0) {
    await place.first().click();
  }

  await page.getByRole("link", { name: "読みはじめる" }).click();
  await expect(page).toHaveURL(/\/reading/);
}

/**
 * 保存が済むまで待つ。
 *
 * 読み物が出た時点ではまだ書き込みが飛んでいる途中で、そのまま履歴へ移ると
 * 何も並んでいない瞬間を掴む。ここで待つのは実装の都合ではなく、
 * 「残した」と画面が言うまでが1つの操作だから。
 */
export async function waitForSaved(page: Page): Promise<void> {
  await expect(page.getByText("この読みは残してあります。")).toBeVisible();
}
