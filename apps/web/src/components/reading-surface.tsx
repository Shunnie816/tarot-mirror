"use client";

import type { ReadingJSON, RenderedReading } from "@tarot-mirror/engine";

import { ReadingView } from "@/components/reading-view";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { CreateFormatPort } from "@/lib/format/types";
import { useRenderedReading } from "@/lib/format/use-rendered-reading";
import { useSession } from "@/lib/session/provider";

/**
 * 読み物の出しどころ。
 *
 * サーバーが辞書だけで組んだ読み物を受け取り、整形が間に合えばそちらに
 * 差し替えてから出す。整形が無くても・落ちても・遅れても、出るものは変わらない。
 *
 * `createPort` はモジュールの外に置く。コンポーネントの中で作ると、レンダーの
 * たびに新しい関数になる（`use-rendered-reading` はそれを見込んで ref で
 * 受けているが、そもそも作らないほうがいい）。
 */
const createPort: CreateFormatPort = async () => {
  if (!isFirebaseConfigured()) return null;

  const { createCallablePort } = await import("@/lib/format/callable-port");
  return createCallablePort();
};

export function ReadingSurface({
  source,
  template,
  footer,
}: {
  readonly source: ReadingJSON;
  /** 辞書だけで組んだ読み物。差し替えの土台でもあり、行き先でもある。 */
  readonly template: RenderedReading;
  readonly footer?: React.ReactNode;
}) {
  const session = useSession();

  // Function は uid を要求するので、サインインが済むまでは呼べない。
  // 「まだ分からない」と「呼べない」を分けて渡す。前者だけが待つ理由になる。
  const enabled =
    session.status === "connecting" ? undefined : session.user !== null;

  const state = useRenderedReading(source, template, createPort, { enabled });

  return (
    <ReadingView
      reading={state.reading}
      settling={state.settling}
      footer={footer}
    />
  );
}
