"use client";

import { getResolver, type Locale, type UiId } from "@tarot-mirror/content";
import { useState } from "react";

import { useSession } from "@/lib/session/provider";
import type { LinkResult, SignInResult } from "@/lib/session/types";

/**
 * アカウントの状態を、必要なときだけ静かに置く。
 *
 * サインアップは求めない。匿名のまま最後まで使えるのが前提で、ここは
 * 「別の端末からも開きたくなったとき」の出口でしかない。だから画面の主役に
 * しないし、繋いでいないことを問題として書かない。
 */

const OUTCOME_COPY: Readonly<Record<LinkResult, UiId>> = {
  linked: "ui.accountLinked",
  cancelled: "ui.accountLinkCancelled",
  alreadyInUse: "ui.accountLinkInUse",
  failed: "ui.accountLinkFailed",
};

const SIGN_IN_COPY: Readonly<Record<SignInResult, UiId>> = {
  signedIn: "ui.accountSignedIn",
  cancelled: "ui.accountSignInCancelled",
  failed: "ui.accountSignInFailed",
};

type Outcome =
  | { readonly kind: "link"; readonly result: LinkResult }
  | { readonly kind: "signIn"; readonly result: SignInResult };

function outcomeCopy(outcome: Outcome): UiId {
  return outcome.kind === "link"
    ? OUTCOME_COPY[outcome.result]
    : SIGN_IN_COPY[outcome.result];
}

export function AccountNotice({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [working, setWorking] = useState(false);

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

  const link = async () => {
    setWorking(true);
    setOutcome({ kind: "link", result: await session.linkGoogle() });
    setWorking(false);
  };

  const open = async () => {
    setWorking(true);
    setOutcome({ kind: "signIn", result: await session.signInGoogle() });
    setWorking(false);
  };

  /**
   * 繋ぐ先がすでに埋まっていたときだけ、そのアカウントを開く道を出す。
   *
   * これが無いと、一度サインアウトした人が自分の記録に戻れない。繋ぎ直そうと
   * しても、その Google はもう向こうのアカウントのものなので `alreadyInUse` で
   * 弾かれ、そこが行き止まりになる。常に出さないのは、開くと**いまの匿名側に
   * 書いたものが辿れなくなる**から。行き止まりのときだけ出す。
   */
  const stuck = outcome?.kind === "link" && outcome.result === "alreadyInUse";

  return (
    <div className="account-notice">
      <p className="screen-note account-notice-text">
        {outcome === null
          ? resolver.ui("ui.accountAnonymous")
          : resolver.ui(outcomeCopy(outcome))}
      </p>
      {stuck ? (
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={() => void open()}
          disabled={working}
        >
          {resolver.ui(working ? "ui.accountOpening" : "ui.accountOpenExisting")}
        </button>
      ) : (
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={() => void link()}
          disabled={working}
        >
          {resolver.ui(working ? "ui.accountLinking" : "ui.accountLink")}
        </button>
      )}
    </div>
  );
}
