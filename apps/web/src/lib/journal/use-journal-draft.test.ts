import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { JournalStore } from "./use-journal-draft";
import { useJournalDraft } from "./use-journal-draft";

/**
 * テスト観点
 *
 *  1. すでに書いてあるものが読み込まれること（Issue #10「後から編集できる」）
 *  2. 書き換えると「書きかけ」になること
 *  3. 書きとめると「書きかけ」でなくなること
 *  4. 保存に失敗しても、書いたものが手元から消えないこと
 *  5. 保存できない状態では入力欄を出さないこと（書かせておいて失う形にしない）
 *  6. 認証の返事待ちと「保存できない」を取り違えないこと
 *  7. 書きとめたあとに書き足せば、また「書きかけ」になること
 *
 * 4 がこのファイルの主題。ここは利用者が自分の言葉で書く場所で、通信の都合で
 * 消えてよいものは1文字も無い。
 */

interface FakeJournal {
  readonly store: JournalStore;
  finishLoad(body: string): void;
  failLoad(): void;
  finishSave(): void;
  failSave(): void;
  lastSaved(): string | null;
}

function createFakeJournal(): FakeJournal {
  let loading: { resolve: (body: string) => void; reject: (e: Error) => void } | null = null;
  let saving: { resolve: () => void; reject: (e: Error) => void } | null = null;
  let lastSaved: string | null = null;

  return {
    store: {
      load: () =>
        new Promise<string>((resolve, reject) => {
          loading = { resolve, reject };
        }),
      save: (_uid, body) =>
        new Promise<void>((resolve, reject) => {
          saving = {
            resolve: () => {
              lastSaved = body;
              resolve();
            },
            reject,
          };
        }),
    },
    finishLoad: (body) => loading?.resolve(body),
    failLoad: () => loading?.reject(new Error("offline")),
    finishSave: () => saving?.resolve(),
    failSave: () => saving?.reject(new Error("offline")),
    lastSaved: () => lastSaved,
  };
}

/** 読み込みが終わったところまで進める。 */
async function mountDraft(journal: FakeJournal, body = "") {
  const rendered = renderHook(() => useJournalDraft("uid-1", journal.store));
  await act(async () => {
    journal.finishLoad(body);
  });
  return rendered;
}

describe("useJournalDraft", () => {
  afterEach(cleanup);

  it("should show what was already written", async () => {
    const journal = createFakeJournal();

    const { result } = await mountDraft(journal, "前に書いたこと");

    expect(result.current.status).toBe("ready");
    expect(result.current.body).toBe("前に書いたこと");
    expect(result.current.dirty).toBe(false);
  });

  it("should notice that the writing has changed", async () => {
    const journal = createFakeJournal();
    const { result } = await mountDraft(journal, "前に書いたこと");

    act(() => {
      result.current.setBody("書き足したこと");
    });

    expect(result.current.dirty).toBe(true);
  });

  it("should settle once the writing is kept", async () => {
    const journal = createFakeJournal();
    const { result } = await mountDraft(journal);
    act(() => {
      result.current.setBody("いま書いたこと");
    });

    await act(async () => {
      const saving = result.current.save();
      journal.finishSave();
      await saving;
    });

    expect(result.current.dirty).toBe(false);
    expect(journal.lastSaved()).toBe("いま書いたこと");
  });

  it("should become unsettled again when more is written", async () => {
    const journal = createFakeJournal();
    const { result } = await mountDraft(journal);
    act(() => {
      result.current.setBody("いま書いたこと");
    });
    await act(async () => {
      const saving = result.current.save();
      journal.finishSave();
      await saving;
    });

    act(() => {
      result.current.setBody("いま書いたこと、それから");
    });

    expect(result.current.dirty).toBe(true);
  });

  it("should not lose the writing when it cannot be kept", async () => {
    const journal = createFakeJournal();
    const { result } = await mountDraft(journal);
    act(() => {
      result.current.setBody("消えては困ること");
    });

    await act(async () => {
      const saving = result.current.save();
      journal.failSave();
      await saving;
    });

    expect(result.current.body).toBe("消えては困ること");
    expect(result.current.failed).toBe(true);
    expect(result.current.dirty).toBe(true);
  });

  it("should not offer a place to write when nothing can be kept", () => {
    const journal = createFakeJournal();

    const { result } = renderHook(() => useJournalDraft(null, journal.store));

    expect(result.current.status).toBe("unavailable");
  });

  it("should wait while the session has not answered yet", () => {
    const journal = createFakeJournal();

    const { result } = renderHook(() => useJournalDraft(undefined, journal.store));

    expect(result.current.status).toBe("loading");
  });

  it("should fold away when what was written cannot be read", async () => {
    const journal = createFakeJournal();
    const { result } = renderHook(() => useJournalDraft("uid-1", journal.store));

    await act(async () => {
      journal.failLoad();
    });

    expect(result.current.status).toBe("unavailable");
  });
});
