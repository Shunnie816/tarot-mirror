import { expect, test } from "@playwright/test";

import { drawOneCard, waitForSaved } from "./flow";

/**
 * テスト観点
 *
 * 1. 名前のない状態では、押しただけでは離れないこと
 * 2. やめれば、そのまま続けられること
 * 3. 分かった上で確認すれば離れられ、そこからまた始められること
 *
 * 3 では履歴が空になることを見る。サインアウトが「別の uid で始め直す」こと
 * だと確かめられるのはここだけで、単体テストはフェイクの認証しか見ていない。
 *
 * 繋いであるアカウントからのサインアウトはここに無い。Google のポップアップを
 * 通す必要があり、エミュレータ相手でも不安定になる。確認を挟むかどうかの分岐は
 * `use-sign-out.test.ts` で両側とも踏んである。
 */
test.describe("サインアウト", () => {
  test("should not leave on the first press while the account has no name", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(
      page.getByText("いまは名前のない状態です。", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "サインアウトする" }).click();

    // 押しただけでは離れない。何が起きるかを先に出す。
    await expect(
      page.getByText("二度と開けなくなります。", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "わかった上でサインアウトする" }),
    ).toBeVisible();
  });

  test("should carry on unchanged when the confirmation is declined", async ({
    page,
  }) => {
    await drawOneCard(page, "やめたら残っているか");
    await waitForSaved(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "サインアウトする" }).click();
    await page.getByRole("button", { name: "やめておく" }).click();

    await expect(page.getByText("サインアウトしました。")).toBeHidden();

    await page.goto("/history");
    await expect(
      page.locator(".history-entry").filter({ hasText: "やめたら残っているか" }),
    ).toHaveCount(1);
  });

  test("should start over with an empty history once it is confirmed", async ({
    page,
  }) => {
    await drawOneCard(page, "離れたら見えなくなるか");
    await waitForSaved(page);

    await page.goto("/history");
    await expect(
      page.locator(".history-entry").filter({ hasText: "離れたら見えなくなるか" }),
    ).toHaveCount(1);

    await page.goto("/settings");
    await page.getByRole("button", { name: "サインアウトする" }).click();
    await page
      .getByRole("button", { name: "わかった上でサインアウトする" })
      .click();

    await expect(page.getByText("サインアウトしました。")).toBeVisible();

    // 離れたあとも使える。ただし別の uid なので、前のものは出てこない。
    await page.goto("/history");
    await expect(
      page.getByText("まだ何も残っていません。", { exact: false }),
    ).toBeVisible();
  });
});
