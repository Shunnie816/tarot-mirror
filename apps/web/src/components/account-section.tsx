"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";

import { useSession } from "@/lib/session/provider";
import { useAccountLink } from "@/lib/session/use-account-link";
import { useSignOut } from "@/lib/session/use-sign-out";

import { accountOutcomeCopy } from "./account-copy";

/**
 * アカウントのことが、ここに全部ある。
 *
 * トップの `AccountNotice` は「別の端末からも開きたくなったとき」の出口
 * でしかなく、引く前の画面を重くしないために一行しか置いていない。その結果、
 * **自分がいまどの状態にいるのかを能動的に探さないと分からない**（#55）。
 * 探しに行った人が辿り着く場所をひとつ作って、そこに揃える。
 *
 * サインアップは求めないという前提は変えない。ここは通り道ではなく行き先で、
 * 引くまでのあいだに一度も通らない。
 */
export function AccountSection({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const account = useAccountLink(session.linkGoogle, session.signInGoogle);
  const anonymous = session.user?.isAnonymous ?? true;
  const signOut = useSignOut(session.signOut, anonymous);

  // フックは状態によらず同じ数だけ呼ぶ。早期 return はそのあとに置く。
  if (session.status === "connecting") return null;

  if (session.status === "unavailable") {
    return (
      <section className="account-section">
        <h2 className="credits-heading">{resolver.ui("ui.accountHeading")}</h2>
        <p className="screen-note">{resolver.ui("ui.accountUnavailable")}</p>
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={session.retry}
        >
          {resolver.ui("ui.accountRetry")}
        </button>
      </section>
    );
  }

  return (
    <section className="account-section">
      <h2 className="credits-heading">{resolver.ui("ui.accountHeading")}</h2>

      {/* いまどちらなのか。書いたものがどこから開けるのかまで含めて一文で言う。 */}
      <p className="screen-note" aria-live="polite">
        {account.outcome === null
          ? resolver.ui(anonymous ? "ui.accountAnonymous" : "ui.accountLinked")
          : resolver.ui(accountOutcomeCopy(account.outcome))}
      </p>

      {anonymous ? (
        <>
          {/* 繋ぐと何が変わるかを先に出す。ボタンだけ置くと、押した先が
              分からないまま押させることになる。 */}
          {account.stuck ? null : (
            <p className="screen-note">{resolver.ui("ui.accountLinkInvite")}</p>
          )}
          <button
            type="button"
            className="button button--outline button--inline"
            onClick={account.stuck ? account.open : account.link}
            disabled={account.working}
          >
            {resolver.ui(
              account.stuck
                ? account.working
                  ? "ui.accountOpening"
                  : "ui.accountOpenExisting"
                : account.working
                  ? "ui.accountLinking"
                  : "ui.accountLink",
            )}
          </button>
        </>
      ) : null}

      <div className="account-leave">
        {signOut.phase === "done" ? (
          <p className="screen-note" aria-live="polite">
            {resolver.ui("ui.signOutDone")}
          </p>
        ) : (
          <>
            <p className="screen-note">
              {resolver.ui(
                anonymous ? "ui.signOutAnonymousNote" : "ui.signOutLinkedNote",
              )}
            </p>

            {signOut.phase === "confirming" ? (
              <div className="sign-out-confirm">
                <p className="screen-note" aria-live="polite">
                  {resolver.ui("ui.signOutConfirmQuestion")}
                </p>
                {/* 引き返す道を先に見せる。確認だけ出して塞ぐと、
                    「消えます」と言われた人に手が無い。 */}
                <p className="screen-note">
                  {resolver.ui("ui.signOutConfirmKeep")}
                </p>
                <div className="sign-out-actions">
                  <button
                    type="button"
                    className="button button--outline button--inline"
                    onClick={signOut.cancel}
                  >
                    {resolver.ui("ui.signOutCancel")}
                  </button>
                  <button
                    type="button"
                    className="button button--quiet button--inline"
                    onClick={signOut.confirm}
                  >
                    {resolver.ui("ui.signOutConfirm")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button button--outline button--inline"
                onClick={signOut.request}
                disabled={signOut.phase === "working"}
              >
                {resolver.ui(
                  signOut.phase === "working" ? "ui.signingOut" : "ui.signOut",
                )}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
