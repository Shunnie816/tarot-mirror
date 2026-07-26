"use client";

import { useCallback, useEffect, useState } from "react";

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

export type DraftStatus = "loading" | "ready" | "unavailable";

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
      .catch(() => {
        // 書いたものを保存できない場所で入力欄を出すのは罠なので、畳む。
        if (active) setStatus("unavailable");
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
