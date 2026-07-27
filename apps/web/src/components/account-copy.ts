import type { UiId } from "@tarot-mirror/content";

import type { LinkResult, SignInResult } from "@/lib/session/types";
import type { AccountOutcome } from "@/lib/session/use-account-link";

/**
 * アカウントの操作の結果を、出す言葉に対応づける。
 *
 * トップの静かな一行と設定のアカウント欄が、同じ出来事に同じ言葉を返すように
 * するためにここに置く。片方だけ言い回しが変わると、同じことが起きたのに
 * 違うことが起きたように読める。
 *
 * 「やめた」と「うまくいかなかった」は、繋ぐときと開くときで言葉を分ける。
 * 同じ語に丸めると、何をやめたのかが読み取れない。
 */

const LINK_COPY: Readonly<Record<LinkResult, UiId>> = {
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

export function accountOutcomeCopy(outcome: AccountOutcome): UiId {
  return outcome.kind === "link"
    ? LINK_COPY[outcome.result]
    : SIGN_IN_COPY[outcome.result];
}
