import { DEFAULT_LOCALE, getResolver } from "@tarot-mirror/content";
import { cookies } from "next/headers";

import { LlmToggle } from "@/components/llm-toggle";
import { LLM_COOKIE, parseLlmPref } from "@/lib/prefs/llm";

/**
 * 読み方の設定。
 *
 * Cookie をサーバーで読んでから描く。クライアントで読むと、サーバーが描いた
 * 画面と一度食い違い、設定が勝手に切り替わったように見える。
 */
export default async function Page() {
  const resolver = getResolver(DEFAULT_LOCALE);
  const store = await cookies();
  const enabled = parseLlmPref(store.get(LLM_COOKIE)?.value);

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

        <LlmToggle locale={DEFAULT_LOCALE} initialEnabled={enabled} />
      </main>
    </div>
  );
}
