"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";

import { useSession } from "@/lib/session/provider";
import { useSignOut } from "@/lib/session/use-sign-out";

/**
 * いまのアカウントから離れる。
 *
 * 設定に置いてあるのは、これが「読むこと」の一部ではないから。トップに出すと
 * 引く前に決めごとを増やすことになるし、押し間違いの機会も増える。
 *
 * 匿名のまま離れるときだけ一段挟む。理由は `use-sign-out.ts` に書いた。
 */
export function SignOutControl({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const anonymous = session.user?.isAnonymous ?? true;
  const flow = useSignOut(session.signOut, anonymous);

  // 応答を待っているあいだと、そもそも繋がっていないときは出さない。
  // 離れる先が無いのに「サインアウト」だけ在るのは、事実と食い違う。
  if (session.status !== "ready") return null;

  return (
    <section className="sign-out">
      <h2 className="credits-heading">{resolver.ui("ui.signOutHeading")}</h2>

      {flow.phase === "done" ? (
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

          {flow.phase === "confirming" ? (
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
                  onClick={flow.cancel}
                >
                  {resolver.ui("ui.signOutCancel")}
                </button>
                <button
                  type="button"
                  className="button button--quiet button--inline"
                  onClick={flow.confirm}
                >
                  {resolver.ui("ui.signOutConfirm")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--outline button--inline"
              onClick={flow.request}
              disabled={flow.phase === "working"}
            >
              {resolver.ui(
                flow.phase === "working" ? "ui.signingOut" : "ui.signOut",
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
