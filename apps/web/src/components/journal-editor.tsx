"use client";

import { getResolver, type Locale } from "@tarot-mirror/content";
import { useMemo } from "react";

import type { JournalStore } from "@/lib/journal/use-journal-draft";
import { useJournalDraft } from "@/lib/journal/use-journal-draft";
import { useSession } from "@/lib/session/provider";

/**
 * 読んだあとに、自分の言葉で書く。
 *
 * ここがこのアプリの目的そのもの。ただし義務にはしない。空のまま先へ進めるし、
 * 促しも数えもしない。「書きましたか」と訊いた瞬間、書くことは宿題になる。
 *
 * 読みごとに1つ。同じ読みについて何度も書くのではなく、書いたものを直していく。
 */

function createReadingJournalStore(readingId: string): JournalStore {
  return {
    load: async (uid) => {
      const [{ getFirebaseDb }, { getJournalForReading }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/store/journal"),
      ]);
      const entry = await getJournalForReading(getFirebaseDb(), uid, readingId);
      return entry?.body ?? "";
    },
    save: async (uid, body) => {
      const [{ getFirebaseDb }, { saveJournalForReading }] = await Promise.all([
        import("@/lib/firebase/client"),
        import("@/lib/store/journal"),
      ]);
      await saveJournalForReading(getFirebaseDb(), uid, readingId, body);
    },
  };
}

export function JournalEditor({
  readingId,
  locale,
}: {
  readonly readingId: string;
  readonly locale: Locale;
}) {
  const resolver = getResolver(locale);
  const session = useSession();
  const store = useMemo(
    () => createReadingJournalStore(readingId),
    [readingId],
  );

  const uid =
    session.status === "connecting" ? undefined : (session.user?.uid ?? null);
  const draft = useJournalDraft(uid, store);

  if (draft.status === "loading") return null;

  if (draft.status === "unavailable") {
    return (
      <p className="screen-note journal-block">
        {resolver.ui("ui.journalUnavailable")}
      </p>
    );
  }

  return (
    <section className="journal-block">
      <div className="journal-head">
        <span className="screen-eyebrow">{resolver.ui("ui.journalEyebrow")}</span>
        <h2 className="journal-heading">{resolver.ui("ui.journalHeading")}</h2>
        <p className="screen-note">{resolver.ui("ui.journalLead")}</p>
      </div>

      <div className="field-block">
        <textarea
          className="field"
          rows={6}
          value={draft.body}
          aria-label={resolver.ui("ui.journalHeading")}
          placeholder={resolver.ui("ui.journalPlaceholder")}
          onChange={(event) => draft.setBody(event.target.value)}
        />
      </div>

      <div className="journal-actions">
        <button
          type="button"
          className="button button--outline button--inline"
          onClick={() => void draft.save()}
          disabled={!draft.dirty || draft.saving}
        >
          {resolver.ui(draft.saving ? "ui.journalSaving" : "ui.journalSave")}
        </button>

        <span className="screen-note" role="status">
          {statusMessage(draft, resolver)}
        </span>
      </div>
    </section>
  );
}

/** 何も言わないときは何も出さない。書いていない人に向けた言葉は要らない。 */
function statusMessage(
  draft: { failed: boolean; dirty: boolean; body: string },
  resolver: ReturnType<typeof getResolver>,
): string {
  if (draft.failed) return resolver.ui("ui.journalFailed");
  if (draft.dirty || draft.body.length === 0) return "";
  return resolver.ui("ui.journalKept");
}
