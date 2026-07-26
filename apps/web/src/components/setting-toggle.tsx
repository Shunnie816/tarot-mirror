"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import { useState } from "react";

import { serializeFlag } from "@/lib/prefs/cookie";

/**
 * 設定ひとつ分。
 *
 * サーバーが読んだ値を初期値として受け取る。ここで自分で Cookie を読むと、
 * サーバーの描画と食い違って一度ちらつく。**設定の正本はサーバーが読んだ値**で、
 * この画面はそれを書き換えるだけ。
 *
 * 押した瞬間に効くのは次の引きから。いま画面に出ている読み物を書き換えないのは、
 * 読んでいる最中に文章が入れ替わらない、という決めごとと同じ理由。
 */
export function SettingToggle({
  locale,
  id,
  cookie,
  initialEnabled,
  label,
  note,
}: {
  readonly locale: Locale;
  /** `<label for>` に使う。Cookie 名をそのまま出すと DOM に実装が漏れる。 */
  readonly id: string;
  readonly cookie: string;
  readonly initialEnabled: boolean;
  readonly label: string;
  readonly note: string;
}) {
  const resolver = getResolver(locale);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [touched, setTouched] = useState(false);

  const change = (next: boolean) => {
    setEnabled(next);
    setTouched(true);
    document.cookie = serializeFlag(cookie, next);
  };

  return (
    <section className="setting">
      <label className="setting-row" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="setting-check"
          checked={enabled}
          onChange={(event) => change(event.target.checked)}
        />
        <span className="setting-label">
          {label}
          {/* いまどちらなのかを言葉でも出す。チェックの有無だけだと、
              選んでいるのか未設定なのかが読み取れない。 */}
          <span className="setting-state">
            {resolver.ui(enabled ? "ui.settingsOn" : "ui.settingsOff")}
          </span>
        </span>
      </label>

      <p className="screen-note setting-note">{note}</p>

      {/* 変えたことだけ伝える。褒めない、勧めない。 */}
      <p className="screen-note" aria-live="polite">
        {touched ? resolver.ui("ui.settingsSaved") : ""}
      </p>
    </section>
  );
}
