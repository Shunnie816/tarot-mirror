import {
  buildFormatPrompt,
  buildRetryPrompt,
  findOutputViolations,
  PROMPT_VERSION,
  type LlmFormatOutput,
} from "@tarot-mirror/engine";

import { renderingKey, type RenderingCache } from "./cache.js";
import type { ModelAnswer, ModelClient, ModelUsage } from "./model.js";
import { parseReadingRequest } from "./reading-input.js";
import { dayKey, type QuotaStore } from "./quota.js";

/**
 * What the function actually does, with no Firebase in sight.
 *
 * `onCall` is a transport. Keeping the decisions — validate, cap, ask, check,
 * retry once, give up — in a plain function means the interesting paths are
 * covered by ordinary unit tests instead of only by deploying and hoping.
 */

export type FailureReason =
  | "invalidRequest"
  | "quotaExhausted"
  | "toneViolation"
  | "modelUnavailable";

export type FormatOutcome =
  | { readonly ok: true; readonly output: LlmFormatOutput }
  | { readonly ok: false; readonly reason: FailureReason };

export interface FormatLog {
  readonly uid: string;
  readonly spreadId: string;
  readonly promptVersion: number;
  readonly attempts: number;
  readonly usage: ModelUsage;
  /** `cached` は「払わずに返せた」の印。実測単価はこれを差し引いて見る。 */
  readonly outcome: "ok" | "cached" | FailureReason;
}

export interface FormatDeps {
  readonly model: ModelClient;
  readonly cache: RenderingCache;
  readonly quota: QuotaStore;
  /** 鍵に含める。差し替えたら古い文章は出さない。 */
  readonly modelName: string;
  /** Token counts and outcomes, so the real cost per reading is observable. */
  readonly log: (entry: FormatLog) => void;
  readonly now: () => Date;
}

const NO_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0 };

function addUsage(a: ModelUsage, b: ModelUsage): ModelUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/**
 * One retry, and only for tone.
 *
 * A tone violation is a wording the model can correct when told which words
 * failed. A transport error is not, so it is not retried here — the client
 * already has a complete reading to fall back on, and a second attempt would
 * only make the fallback slower.
 */
export async function formatReading(
  uid: string,
  data: unknown,
  deps: FormatDeps,
): Promise<FormatOutcome> {
  const parsed = parseReadingRequest(data);
  if (!parsed.ok) {
    deps.log({
      uid,
      spreadId: "-",
      promptVersion: PROMPT_VERSION,
      attempts: 0,
      usage: NO_USAGE,
      outcome: "invalidRequest",
    });
    return { ok: false, reason: "invalidRequest" };
  }

  const { reading, locale } = parsed.request;
  const record = (
    attempts: number,
    usage: ModelUsage,
    outcome: FormatLog["outcome"],
  ) =>
    deps.log({
      uid,
      spreadId: reading.spreadId,
      promptVersion: PROMPT_VERSION,
      attempts,
      usage,
      outcome,
    });

  // 上限より先に見る。二度目の表示で回数が減るなら、履歴を開くことが
  // 遠慮の対象になってしまう。払っていないものは数えない。
  const key = renderingKey({
    reading,
    locale,
    promptVersion: PROMPT_VERSION,
    model: deps.modelName,
  });

  const cached = await deps.cache.get(uid, key).catch(() => null);
  if (cached !== null) {
    record(0, NO_USAGE, "cached");
    return { ok: true, output: cached };
  }

  if (!(await deps.quota.consume(uid, dayKey(deps.now())))) {
    record(0, NO_USAGE, "quotaExhausted");
    return { ok: false, reason: "quotaExhausted" };
  }

  const ATTEMPTS = 2;
  let prompt = buildFormatPrompt(reading, locale);
  let usage = NO_USAGE;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    let answer: ModelAnswer;
    try {
      answer = await deps.model.complete(prompt);
    } catch {
      // 通信や認証の失敗はモデルに直せることではない。クライアントには
      // すでに完成した読み物があるので、二度目を待たせるほうが損。
      record(attempt, usage, "modelUnavailable");
      return { ok: false, reason: "modelUnavailable" };
    }

    usage = addUsage(usage, answer.usage);

    const violations = findOutputViolations(answer.output);
    if (violations.length === 0) {
      // 残せなくても答えは返す。キャッシュは付随物で、読み物ではない。
      await deps.cache.put(uid, key, answer.output).catch(() => undefined);
      record(attempt, usage, "ok");
      return { ok: true, output: answer.output };
    }

    if (attempt < ATTEMPTS) {
      prompt = buildRetryPrompt(prompt, violations, locale);
    }
  }

  record(ATTEMPTS, usage, "toneViolation");
  return { ok: false, reason: "toneViolation" };
}
