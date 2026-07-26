"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import { useState } from "react";

import { serializeLlmPref } from "@/lib/prefs/llm";

/**
 * 整形を使うかどうか。
 *
 * サーバーが読んだ値を初期値として受け取る。ここで自分で Cookie を読むと、
 * サーバーの描画と食い違って一度ちらつく。**設定の正本はサーバーが読んだ値**で、
 * この画面はそれを書き換えるだけ。
 *
 * 押した瞬間に効くのは次の引きから。いま画面に出ている読み物を書き換えないのは、
 * 読んでいる最中に文章が入れ替わらない、という決めごとと同じ理由。
 */
export function LlmToggle({
  locale,
  initialEnabled,
}: {
  readonly locale: Locale;
  readonly initialEnabled: boolean;
}) {
  const resolver = getResolver(locale);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [touched, setTouched] = useState(false);

  const change = (next: boolean) => {
    setEnabled(next);
    setTouched(true);
    document.cookie = serializeLlmPref(next);
  };

  return (
    <section className="setting">
      <label className="setting-row" htmlFor="llm">
        <input
          id="llm"
          type="checkbox"
          className="setting-check"
          checked={enabled}
          onChange={(event) => change(event.target.checked)}
        />
        <span className="setting-label">
          {resolver.ui("ui.settingsLlmLabel")}
          <span className="setting-state">
            {resolver.ui(enabled ? "ui.settingsLlmOn" : "ui.settingsLlmOff")}
          </span>
        </span>
      </label>

      <p className="screen-note setting-note">
        {resolver.ui("ui.settingsLlmNote")}
      </p>

      {/* 変えたことだけ伝える。褒めない、勧めない。 */}
      <p className="screen-note" aria-live="polite">
        {touched ? resolver.ui("ui.settingsSaved") : ""}
      </p>
    </section>
  );
}
