import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  THREE_CARDS,
  type LlmFormatOutput,
  type ReadingJSON,
} from "@tarot-mirror/engine";
import { describe, expect, it } from "vitest";

import { formatReading, type FormatDeps, type FormatLog } from "./format.js";
import type { ModelAnswer, ModelClient } from "./model.js";
import type { QuotaStore } from "./quota.js";

/**
 * 観点
 *
 * 1. 素性の知れない要求はモデルを呼ぶ前に断る（このエンドポイントを汎用の
 *    文章生成に使わせない）
 * 2. 1日の上限を超えたら呼ばない
 * 3. トーンを外した答えは、どこが外れたかを伝えて1回だけ引き直す
 * 4. 通信の失敗は引き直さない（クライアントには完成した読み物がある）
 * 5. 入出力トークンを毎回残す
 */

const UID = "tester";

const reading = (): ReadingJSON =>
  createReading({
    spread: THREE_CARDS,
    deck: riderWaite,
    seed: "format-fn",
    question: "いまの働き方を続けるか迷っている",
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

const request = (override: Partial<ReadingJSON> = {}) => ({
  reading: { ...reading(), ...override },
  locale: "ja" as const,
});

const answerWith = (text: string): LlmFormatOutput => ({
  positions: reading().positions.map((position) => ({
    positionId: position.positionId,
    text,
  })),
  synthesis: "三枚をならべると、静かな移り変わりが見えてくるかもしれません。",
  closingQuestion: "いま、手放さずにいるものは何でしょうか。",
});

const CLEAN = answerWith("そう受け取ることもできます。");

/** Answers the queue in order; records what it was asked. */
function scriptedModel(
  answers: ReadonlyArray<LlmFormatOutput | Error>,
): ModelClient & { readonly prompts: string[] } {
  const prompts: string[] = [];
  let call = 0;

  return {
    prompts,
    complete: async (prompt): Promise<ModelAnswer> => {
      prompts.push(prompt.user);
      const answer = answers[call];
      call += 1;
      if (answer === undefined) throw new Error("model called too many times");
      if (answer instanceof Error) throw answer;
      return {
        output: answer,
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    },
  };
}

const allowingQuota = (): QuotaStore => ({ consume: async () => true });
const exhaustedQuota = (): QuotaStore => ({ consume: async () => false });

function depsFor(
  model: ModelClient,
  quota: QuotaStore = allowingQuota(),
): FormatDeps & { readonly logs: FormatLog[] } {
  const logs: FormatLog[] = [];
  return {
    logs,
    model,
    quota,
    log: (entry) => logs.push(entry),
    now: () => new Date("2026-07-26T09:00:00.000Z"),
  };
}

describe("formatReading", () => {
  it("should return the model's prose when it keeps to the tone rules", async () => {
    const deps = depsFor(scriptedModel([CLEAN]));

    const result = await formatReading(UID, request(), deps);

    expect(result).toEqual({ ok: true, output: CLEAN });
  });

  /**
   * 匿名でサインインできる以上、誰でもこの関数を呼べる。素性の知れない ID を
   * 通すと、有料のモデルが汎用の文章生成器になる。
   */
  it("should refuse a reading whose ids are not in the dictionary", async () => {
    const model = scriptedModel([CLEAN]);
    const deps = depsFor(model);
    const source = reading();

    const result = await formatReading(
      UID,
      {
        ...request(),
        reading: {
          ...source,
          positions: source.positions.map((p) => ({
            ...p,
            keywords: ["kw.madeUp"],
          })),
        },
      },
      deps,
    );

    expect(result).toEqual({ ok: false, reason: "invalidRequest" });
    expect(model.prompts).toEqual([]);
  });

  it("should refuse positions that do not belong to the spread", async () => {
    const model = scriptedModel([CLEAN]);
    const source = reading();

    const result = await formatReading(
      UID,
      { ...request(), reading: { ...source, positions: source.positions.slice(1) } },
      depsFor(model),
    );

    expect(result).toEqual({ ok: false, reason: "invalidRequest" });
    expect(model.prompts).toEqual([]);
  });

  it("should not call the model once the daily allowance is used up", async () => {
    const model = scriptedModel([CLEAN]);

    const result = await formatReading(
      UID,
      request(),
      depsFor(model, exhaustedQuota()),
    );

    expect(result).toEqual({ ok: false, reason: "quotaExhausted" });
    expect(model.prompts).toEqual([]);
  });

  it("should retry once, naming the wording that failed", async () => {
    const model = scriptedModel([answerWith("必ず前に進めます。"), CLEAN]);
    const deps = depsFor(model);

    const result = await formatReading(UID, request(), deps);

    expect(result).toEqual({ ok: true, output: CLEAN });
    expect(model.prompts).toHaveLength(2);
    expect(model.prompts[1]).toContain("必ず");
  });

  it("should give up after the retry also breaks the tone rules", async () => {
    const model = scriptedModel([
      answerWith("必ず前に進めます。"),
      answerWith("絶対に大丈夫です。"),
    ]);

    const result = await formatReading(UID, request(), depsFor(model));

    expect(result).toEqual({ ok: false, reason: "toneViolation" });
    expect(model.prompts).toHaveLength(2);
  });

  it("should not retry when the model itself is unreachable", async () => {
    const model = scriptedModel([new Error("503")]);

    const result = await formatReading(UID, request(), depsFor(model));

    expect(result).toEqual({ ok: false, reason: "modelUnavailable" });
    expect(model.prompts).toHaveLength(1);
  });

  /** Issue #11: 実測単価を確かめられるように、毎回残す。 */
  it("should log the tokens spent across every attempt", async () => {
    const deps = depsFor(
      scriptedModel([answerWith("必ず前に進めます。"), CLEAN]),
    );

    await formatReading(UID, request(), deps);

    expect(deps.logs).toHaveLength(1);
    expect(deps.logs[0]).toMatchObject({
      uid: UID,
      spreadId: "threeCards",
      attempts: 2,
      outcome: "ok",
      usage: { inputTokens: 200, outputTokens: 100 },
    });
  });

  it("should log why a reading was refused", async () => {
    const deps = depsFor(scriptedModel([]), exhaustedQuota());

    await formatReading(UID, request(), deps);

    expect(deps.logs[0]?.outcome).toBe("quotaExhausted");
  });
});
