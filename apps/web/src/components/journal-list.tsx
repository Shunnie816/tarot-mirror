"use client";

import {
  type CopyResolver,
  getResolver,
  interpolate,
  type Locale,
} from "@tarot-mirror/content";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { buildHref, isSpreadId } from "@/lib/flow";
import { useSession } from "@/lib/session/provider";
import type { JournalEntry } from "@/lib/store/journal";
import { parseReadingDocId } from "@/lib/store/reading-doc";

/**
 * 書きとめたものを並べる。
 *
 * 文字数も、書いた日数の連続も数えない。続けて書いていることを褒めはじめると、
 * 書くことは習慣の達成になり、書きたくない日に書かないことが失敗になる。
 */

type Status = "loading" | "ready" | "unavailable";

async function store() {
  const [{ getFirebaseDb }, journal] = await Promise.all([
    import("@/lib/firebase/client"),
    import("@/lib/store/journal"),
  ]);
  return { db: getFirebaseDb(), ...journal };
}

/** 読みに紐づく記入なら、その読みへ戻る道を作る。 */
function readingHref(entry: JournalEntry): string | null {
  if (entry.readingId === undefined) return null;

  const parsed = parseReadingDocId(entry.readingId);
  if (parsed === null || !isSpreadId(parsed.spreadId)) return null;

  return buildHref("/reading", { spread: parsed.spreadId, seed: parsed.seed });
}

function formatDate(resolver: CopyResolver, date: Date): string {
  return interpolate(resolver.ui("ui.dateFormat"), {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
  });
}

/**
 * 1件。読むかたちで置き、押したときだけ書くかたちになる。
 * 最初から入力欄を並べると、一覧が「未記入の用紙」に見える。
 */
function Entry({
  entry,
  resolver,
  onSave,
}: {
  readonly entry: JournalEntry;
  readonly resolver: CopyResolver;
  readonly onSave: (id: string, body: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(entry.body);
  const [busy, setBusy] = useState(false);

  const href = readingHref(entry);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(entry.id, body);
      setEditing(false);
    } catch {
      // 書いたものは入力欄に残したままにする。
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="journal-entry">
      {entry.createdAt !== null && (
        <span className="journal-entry-date">
          {formatDate(resolver, entry.createdAt)}
        </span>
      )}

      {editing ? (
        <>
          <div className="field-block">
            <textarea
              className="field"
              rows={5}
              value={body}
              aria-label={resolver.ui("ui.journalEdit")}
              placeholder={resolver.ui("ui.journalPlaceholder")}
              onChange={(event) => setBody(event.target.value)}
            />
            <span className="screen-note">
              {resolver.ui("ui.journalClear")}
            </span>
          </div>
          <div className="journal-actions">
            <button
              type="button"
              className="button button--outline button--inline"
              onClick={() => void save()}
              disabled={busy || body === entry.body}
            >
              {resolver.ui(busy ? "ui.journalSaving" : "ui.journalSave")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="journal-entry-body">{entry.body}</p>
          <div className="journal-entry-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => setEditing(true)}
            >
              {resolver.ui("ui.journalEdit")}
            </button>
            {href !== null && (
              <Link href={href} className="quiet-link">
                {resolver.ui("ui.journalFromReading")}
              </Link>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export function JournalList({ locale }: { readonly locale: Locale }) {
  const resolver = getResolver(locale);
  const session = useSession();
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<readonly JournalEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const uid =
    session.status === "connecting" ? undefined : (session.user?.uid ?? null);

  const reload = useCallback(async (owner: string) => {
    const { db, listJournalEntries } = await store();
    setEntries(await listJournalEntries(db, owner));
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (uid === undefined) return;
    if (uid === null) {
      setStatus("unavailable");
      return;
    }

    let active = true;
    setStatus("loading");
    void reload(uid).catch(() => {
      if (active) setStatus("unavailable");
    });

    return () => {
      active = false;
    };
  }, [uid, reload]);

  const add = async () => {
    if (uid === null || uid === undefined || draft.trim() === "") return;
    setBusy(true);
    try {
      const { db, addJournalEntry } = await store();
      await addJournalEntry(db, uid, draft);
      setDraft("");
      await reload(uid);
    } catch {
      // 書いたものは入力欄に残す。消えて困るのは利用者の言葉のほう。
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = useCallback(
    async (id: string, body: string) => {
      if (uid === null || uid === undefined) return;
      const { db, updateJournalEntry } = await store();
      await updateJournalEntry(db, uid, id, body);
      await reload(uid);
    },
    [uid, reload],
  );

  if (status === "loading") {
    return <p className="screen-note">{resolver.ui("ui.journalLoading")}</p>;
  }

  if (status === "unavailable") {
    return <p className="screen-note">{resolver.ui("ui.journalUnavailable")}</p>;
  }

  return (
    <>
      <section className="journal-block">
        <div className="journal-head">
          <h2 className="journal-heading">
            {resolver.ui("ui.journalNewHeading")}
          </h2>
          <p className="screen-note">{resolver.ui("ui.journalNewLead")}</p>
        </div>

        <div className="field-block">
          <textarea
            className="field"
            rows={4}
            value={draft}
            aria-label={resolver.ui("ui.journalNewHeading")}
            placeholder={resolver.ui("ui.journalPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>

        <div className="journal-actions">
          <button
            type="button"
            className="button button--outline button--inline"
            onClick={() => void add()}
            disabled={busy || draft.trim() === ""}
          >
            {resolver.ui(busy ? "ui.journalSaving" : "ui.journalAdd")}
          </button>
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="screen-lead">{resolver.ui("ui.journalEmpty")}</p>
      ) : (
        <ul className="journal-entries">
          {entries.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              resolver={resolver}
              onSave={saveEntry}
            />
          ))}
        </ul>
      )}
    </>
  );
}
