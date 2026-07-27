"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";

import { useSession } from "@/lib/session/provider";
import { useAccountLink } from "@/lib/session/use-account-link";

import { accountOutcomeCopy } from "./account-copy";

/**
 * アカウントの状態を、必要なときだけ静かに置く。
 *
 * サインアップは求めない。匿名のまま最後まで使えるのが前提で、ここは
 * 「別の端末からも開きたくなったとき」の出口でしかない。だから画面の主役に
 * しないし、繋いでいないことを問題として書かない。
 *
 * 全体像（いまの状態・どこに残るか・離れる）は設定のアカウント欄にある。
 * ここはトップに置くものなので、引く前の画面を重くしない一行に留める。
 */
export function AccountNotice({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const account = useAccountLink(session.linkGoogle, session.signInGoogle);

  // 応答を待っているあいだは何も出さない。一瞬だけ「保存されません」と
  // 出てから消えるのは、事実としても体験としても正しくない。
  if (session.status === "connecting") return null;

  if (session.status === "unavailable") {
    return (
      <div className="account-notice">
        <p className="screen-note account-notice-text">
          {resolver.ui("ui.accountUnavailable")}
        </p>
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={session.retry}
        >
          {resolver.ui("ui.accountRetry")}
        </button>
      </div>
    );
  }

  const isAnonymous = session.user?.isAnonymous ?? true;

  if (!isAnonymous) {
    return (
      <div className="account-notice">
        <p className="screen-note account-notice-text">
          {resolver.ui("ui.accountLinked")}
        </p>
      </div>
    );
  }

  return (
    <div className="account-notice">
      <p className="screen-note account-notice-text">
        {account.outcome === null
          ? resolver.ui("ui.accountAnonymous")
          : resolver.ui(accountOutcomeCopy(account.outcome))}
      </p>
      {account.stuck ? (
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={account.open}
          disabled={account.working}
        >
          {resolver.ui(
            account.working ? "ui.accountOpening" : "ui.accountOpenExisting",
          )}
        </button>
      ) : (
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={account.link}
          disabled={account.working}
        >
          {resolver.ui(
            account.working ? "ui.accountLinking" : "ui.accountLink",
          )}
        </button>
      )}
    </div>
  );
}
