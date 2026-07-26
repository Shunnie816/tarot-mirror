import { riderWaite } from "@tarot-mirror/decks";
import {
  createReading,
  THREE_CARDS,
  type LlmFormatOutput,
  type ReadingJSON,
} from "@tarot-mirror/engine";
import { describe, expect, it } from "vitest";

import type { RenderingCache } from "./cache.js";
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
 * 6. 一度整えたものに二度払わない
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

/** 数えた回数を見たいときに使う。 */
function countingQuota(limit = 99): QuotaStore & { readonly used: () => number } {
  let used = 0;
  return {
    used: () => used,
    consume: async () => {
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}

const exhaustedQuota = (): QuotaStore => ({ consume: async () => false });

/** その場限りのキャッシュ。Firestore を持ち出さずに当たり外れだけを見る。 */
function memoryCache(): RenderingCache & { readonly size: () => number } {
  const store = new Map<string, LlmFormatOutput>();
  return {
    size: () => store.size,
    get: async (uid, key) => store.get(`${uid}/${key}`) ?? null,
    put: async (uid, key, output) => {
      store.set(`${uid}/${key}`, output);
    },
  };
}

const noCache = (): RenderingCache => ({
  get: async () => null,
  put: async () => undefined,
});

function depsFor(
  model: ModelClient,
  quota: QuotaStore = allowingQuota(),
  cache: RenderingCache = noCache(),
): FormatDeps & { readonly logs: FormatLog[] } {
  const logs: FormatLog[] = [];
  return {
    logs,
    model,
    cache,
    modelName: "claude-haiku-4-5",
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

/**
 * Issue #12 — ReadingJSON は決定的なので、履歴から開き直せば必ず当たる。
 */
describe("formatReading (cache)", () => {
  it("should call the model once for a reading opened twice", async () => {
    // 2度呼ばれたら scriptedModel が投げるので、それ自体が検証になる。
    const model = scriptedModel([CLEAN]);
    const deps = depsFor(model, allowingQuota(), memoryCache());

    const first = await formatReading(UID, request(), deps);
    const second = await formatReading(UID, request(), deps);

    expect(first).toEqual({ ok: true, output: CLEAN });
    expect(second).toEqual({ ok: true, output: CLEAN });
    expect(model.prompts).toHaveLength(1);
  });

  /**
   * 二度目の表示で残り回数が減るなら、履歴を開くことが遠慮の対象になる。
   * 払っていないものは数えない。
   */
  it("should not spend the daily allowance on a reading it already has", async () => {
    const quota = countingQuota();
    const deps = depsFor(scriptedModel([CLEAN]), quota, memoryCache());

    await formatReading(UID, request(), deps);
    await formatReading(UID, request(), deps);

    expect(quota.used()).toBe(1);
  });

  it("should say in the log that nothing was paid for", async () => {
    const deps = depsFor(scriptedModel([CLEAN]), allowingQuota(), memoryCache());

    await formatReading(UID, request(), deps);
    await formatReading(UID, request(), deps);

    expect(deps.logs.map((entry) => entry.outcome)).toEqual(["ok", "cached"]);
    expect(deps.logs[1]?.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("should keep one person's rendering out of another's", async () => {
    const model = scriptedModel([CLEAN, CLEAN]);
    const deps = depsFor(model, allowingQuota(), memoryCache());

    await formatReading("first", request(), deps);
    await formatReading("second", request(), deps);

    expect(model.prompts).toHaveLength(2);
  });

  it("should not keep an answer it refused to use", async () => {
    const cache = memoryCache();
    const deps = depsFor(
      scriptedModel([answerWith("必ず前に進めます。"), answerWith("絶対に。")]),
      allowingQuota(),
      cache,
    );

    await formatReading(UID, request(), deps);

    expect(cache.size()).toBe(0);
  });

  it("should still answer when the cache cannot be reached", async () => {
    const broken: RenderingCache = {
      get: async () => {
        throw new Error("firestore down");
      },
      put: async () => {
        throw new Error("firestore down");
      },
    };
    const deps = depsFor(scriptedModel([CLEAN]), allowingQuota(), broken);

    const result = await formatReading(UID, request(), deps);

    expect(result).toEqual({ ok: true, output: CLEAN });
  });
});
