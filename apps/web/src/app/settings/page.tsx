import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { cookies } from "next/headers";

import { SettingToggle } from "@/components/setting-toggle";
import { LLM_COOKIE, parseLlmPref } from "@/lib/prefs/llm";
import { REVERSALS_COOKIE, parseReversalsPref } from "@/lib/prefs/reversals";

/**
 * 読み方の設定。
 *
 * Cookie をサーバーで読んでから描く。クライアントで読むと、サーバーが描いた
 * 画面と一度食い違い、設定が勝手に切り替わったように見える。
 *
 * 「おすすめ」を付けない。どちらの読み方も等しく正しい。
 */
export default async function Page() {
  const resolver = getResolver(DEFAULT_LOCALE);
  const store = await cookies();

  return (
    <div className="screen">
      <main className="screen-narrow">
        <header className="screen-header">
          <span className="screen-eyebrow">
            {resolver.ui("ui.settingsEyebrow")}
          </span>
          <h1 className="screen-title">{resolver.ui("ui.settingsTitle")}</h1>
          <p className="screen-lead">{resolver.ui("ui.settingsLead")}</p>
        </header>

        <SettingToggle
          locale={DEFAULT_LOCALE}
          id="reversals"
          cookie={REVERSALS_COOKIE}
          initialEnabled={parseReversalsPref(store.get(REVERSALS_COOKIE)?.value)}
          label={resolver.ui("ui.settingsReversalsLabel")}
          note={resolver.ui("ui.settingsReversalsNote")}
        />

        <SettingToggle
          locale={DEFAULT_LOCALE}
          id="llm"
          cookie={LLM_COOKIE}
          initialEnabled={parseLlmPref(store.get(LLM_COOKIE)?.value)}
          label={resolver.ui("ui.settingsLlmLabel")}
          note={resolver.ui("ui.settingsLlmNote")}
        />
      </main>
    </div>
  );
}
