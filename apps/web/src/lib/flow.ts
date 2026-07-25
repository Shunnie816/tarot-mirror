import { SPREADS, type SpreadId } from "@tarot-mirror/engine";

/**
 * 画面のあいだで持ち回る状態は URL に置く。
 *
 * 同じ seed なら必ず同じリーディングになるので、URL がそのままリーディングの
 * 識別子になる。共有しても、あとで開き直しても、Issue に貼っても同じものが出る。
 * ストアを持たずに済むのは決定性のおかげ。
 */
export interface FlowParams {
  readonly question?: string;
  readonly spread: SpreadId;
  readonly seed: string;
}

export type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isSpreadId(value: string): value is SpreadId {
  return Object.hasOwn(SPREADS, value);
}

export function readQuestion(params: RawParams): string | undefined {
  return one(params, "q");
}

export function readSpread(params: RawParams): SpreadId {
  const raw = one(params, "spread");
  return raw !== undefined && isSpreadId(raw) ? raw : "threeCards";
}

export function readSeed(params: RawParams): string | undefined {
  return one(params, "seed");
}

export function buildHref(
  path: string,
  params: Partial<FlowParams>,
): string {
  const search = new URLSearchParams();
  if (params.question !== undefined && params.question.length > 0) {
    search.set("q", params.question);
  }
  if (params.spread !== undefined) search.set("spread", params.spread);
  if (params.seed !== undefined) search.set("seed", params.seed);

  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}
