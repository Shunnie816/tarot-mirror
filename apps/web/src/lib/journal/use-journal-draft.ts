"use client";

import { useCallback, useEffect, useState } from "react";

import { reportStoreFailure } from "@/lib/store/report";

/**
 * 書きかけを持つ。
 *
 * 保存に失敗しても、書いたものは手元から消さない。ここは利用者が自分の言葉で
 * 書く場所で、通信の都合で消えてよいものは1文字も無い。失敗は伝えるが、
 * 入力欄は触らない。
 */

export interface JournalStore {
  /** すでに書いてあるもの。無ければ空文字。 */
  load(uid: string): Promise<string>;
  save(uid: string, body: string): Promise<void>;
}

/**
 * `unavailable` は「保存できない場所にいる」、`failed` は「読みにいって失敗した」。
 * 前者では入力欄を出さないのが正しいが、後者で畳んでしまうと、一時的に読めなかった
 * だけの人に「ここには書けません」と言うことになる（Issue #52）。
 */
export type DraftStatus = "loading" | "ready" | "unavailable" | "failed";

export interface JournalDraft {
  readonly status: DraftStatus;
  readonly body: string;
  /** 最後に書きとめたものと違うか。 */
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly failed: boolean;
  setBody(next: string): void;
  save(): Promise<void>;
}

export function useJournalDraft(
  uid: string | null | undefined,
  store: JournalStore,
): JournalDraft {
  const [body, setBody] = useState("");
  /** 最後に書きとめられた内容。これとの差が「書きかけ」。 */
  const [kept, setKept] = useState("");
  const [status, setStatus] = useState<DraftStatus>("loading");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (uid === undefined) {
      setStatus("loading");
      return;
    }
    if (uid === null) {
      setStatus("unavailable");
      return;
    }

    let active = true;
    setStatus("loading");

    store
      .load(uid)
      .then((loaded) => {
        if (!active) return;
        setBody(loaded);
        setKept(loaded);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        // 読めなかっただけなので、書けないと言い切らない。
        reportStoreFailure("書きとめたものを読み込めなかった", error);
        if (active) setStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [uid, store]);

  const save = useCallback(async () => {
    if (uid === null || uid === undefined) return;

    setSaving(true);
    setFailed(false);
    try {
      await store.save(uid, body);
      setKept(body);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [uid, store, body]);

  return {
    status,
    body,
    dirty: body !== kept,
    saving,
    failed,
    setBody,
    save,
  };
}
