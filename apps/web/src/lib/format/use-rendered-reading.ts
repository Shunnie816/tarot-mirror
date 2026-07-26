"use client";

import {
  mergeLlmOutput,
  type ReadingJSON,
  type RenderedReading,
} from "@tarot-mirror/engine";
import { useEffect, useRef, useState } from "react";

import type { CreateFormatPort } from "./types";

/**
 * 読み物を、テンプレートから始めて、間に合えば整えたものに差し替える。
 *
 * 差し替えは一度きりで、しかも本文が画面に出る前にしか起きない。読んでいる
 * 最中に文章が書き換わるのは、読む側からすれば故障に見える。だから待つあいだは
 * 本文を出さず（盤面と問いは出す）、時間切れになったらテンプレートで確定させて、
 * あとから届いた答えは捨てる。
 *
 * どの道を通っても RenderedReading が必ずある。整形はあってもなくてもよい上乗せ
 * であって、読めるかどうかを左右しない。
 */

/** これ以上待たせるくらいなら、辞書の文章で読み始めてもらったほうがいい。 */
export const SETTLE_TIMEOUT_MS = 6000;

export interface ProseState {
  /** 本文を出さずに待っている最中か。 */
  readonly settling: boolean;
  readonly reading: RenderedReading;
}

export interface RenderedReadingOptions {
  /**
   * 呼べる状態か。`undefined` は「まだ分からない」で、待つ理由になる。
   * サインインが済むまで呼べないので、その待ちもここで表す。
   */
  readonly enabled?: boolean | undefined;
  readonly timeoutMs?: number;
  /** 捨てた理由の受け取り口。既定では黙って捨てる。 */
  readonly onFallback?: (reason: "rejected" | "unavailable") => void;
}

export function useRenderedReading(
  source: ReadingJSON,
  template: RenderedReading,
  createPort: CreateFormatPort,
  options: RenderedReadingOptions = {},
): ProseState {
  // `undefined` が「まだ分からない」という意味を持つので、分割代入の既定値
  // （`enabled = true`）は使えない。渡されなかったことと、渡されたうえで
  // まだ決まっていないことを、同じ値に潰してしまう。
  const enabled = "enabled" in options ? options.enabled : true;

  /**
   * 呼ばないと分かっているなら、最初から待たない。
   *
   * ここを常に `true` から始めると、整形を使わない設定でもサーバーが描く
   * HTML が本文を伏せた状態になる。既定の（無料で・速い）経路にだけ
   * 待ち時間を足すことになり、順序があべこべ。
   */
  const [state, setState] = useState<ProseState>(() => ({
    settling: enabled !== false,
    reading: template,
  }));

  /**
   * やり直す理由は「引きが変わったこと」と「呼べるようになったこと」だけ。
   *
   * 残りの引数はレンダーのたびに新しい参照になりうる。それを依存配列に置くと
   * effect が起動しつづけ、setState がまたレンダーを呼んで止まらなくなる
   * （CLAUDE.md の renderHook の注意点そのもの）。ref で最新を持てば、
   * 呼び出し側がその場で関数を書いても壊れない。
   */
  const key = `${source.spreadId}:${source.seed}`;
  const { timeoutMs = SETTLE_TIMEOUT_MS, onFallback } = options;

  const latest = useRef({ source, template, createPort, onFallback });
  latest.current = { source, template, createPort, onFallback };

  // 待てる時間は最初に決める。サインインを待ってから呼ぶので effect は
  // 二度走るが、そのたびに時計を戻すと待ち時間が倍になる。
  const deadline = useRef<{ key: string; at: number } | null>(null);
  if (deadline.current?.key !== key) {
    deadline.current = { key, at: Date.now() + timeoutMs };
  }

  // 一度出した本文は引っ込めない。時間切れで確定したあとにサインインが
  // 済んでも、読み始めた人の画面を伏せ直すことはしない。
  const committed = useRef<string | null>(null);

  useEffect(() => {
    if (committed.current === key) return;

    const {
      source: reading,
      template: base,
      createPort: create,
      onFallback: notify,
    } = latest.current;
    let settled = false;

    const settle = (next: RenderedReading) => {
      if (settled) return;
      settled = true;
      committed.current = key;
      setState({ settling: false, reading: next });
    };

    // 呼ばないと決まっている。伏せる前に決着させる。
    if (enabled === false) {
      settle(base);
      return;
    }

    setState({ settling: true, reading: base });

    const remaining = Math.max(0, (deadline.current?.at ?? 0) - Date.now());
    const timer = setTimeout(() => settle(base), remaining);

    // まだ呼べるかどうか分からない。時計だけ回して次の合図を待つ。
    if (enabled === undefined) {
      return () => clearTimeout(timer);
    }

    const attempt = async () => {
      const port = await create();
      if (port === null) return settle(base);

      const output = await port.format(reading, base.locale);
      if (output === null) {
        notify?.("unavailable");
        return settle(base);
      }

      const merged = mergeLlmOutput(base, output);
      if (!merged.ok) {
        notify?.("rejected");
        return settle(base);
      }

      settle(merged.reading);
    };

    void attempt().catch(() => {
      notify?.("unavailable");
      settle(base);
    });

    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [key, enabled, timeoutMs]);

  return state;
}
