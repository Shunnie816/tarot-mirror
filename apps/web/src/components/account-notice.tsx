"use client";

import { getResolver, type Locale, type UiId } from "@tarot-mirror/content";
import { useState } from "react";

import { useSession } from "@/lib/session/provider";
import type { LinkResult } from "@/lib/session/types";

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

export function AccountNotice({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const [outcome, setOutcome] = useState<LinkResult | null>(null);
  const [linking, setLinking] = useState(false);

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
    setLinking(true);
    setOutcome(await session.linkGoogle());
    setLinking(false);
  };

  return (
    <div className="account-notice">
      <p className="screen-note account-notice-text">
        {outcome === null
          ? resolver.ui("ui.accountAnonymous")
          : resolver.ui(OUTCOME_COPY[outcome])}
      </p>
      <button
        type="button"
        className="button button--outline button--inline"
        onClick={() => void link()}
        disabled={linking}
      >
        {resolver.ui(linking ? "ui.accountLinking" : "ui.accountLink")}
      </button>
    </div>
  );
}
