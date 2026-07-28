import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { THREE_CARDS } from "../spreads";
import { createReading } from "../synthesize";
import type { ReadingJSON } from "../types";
import {
  createLlmRenderer,
  mergeLlmOutput,
  type FormatPort,
  type LlmFormatOutput,
  type Rejection,
} from "./llm";
import { renderTemplate } from "./template";

/**
 * 観点
 *
 * 1. 通ったとき: 本文だけが差し替わり、カード名・位置名は辞書のまま
 * 2. 落としたとき: 丸ごとテンプレートに戻る（文体の混ざった読み物を作らない）
 * 3. 落とす条件: 位置の欠落 / 空文 / トーン違反
 * 4. なぜ落としたかが呼び出し側に届く
 * 5. **どう転んでも読み物は完成する**（このプロジェクトの中心的な不変条件）
 */

const source: ReadingJSON = createReading({
  spread: THREE_CARDS,
  deck: riderWaite,
  seed: "llm-renderer",
  question: "いまの働き方を続けるか迷っている",
  now: () => new Date("2026-07-25T00:00:00.000Z"),
});

const template = renderTemplate(source, "ja");

const goodOutput = (): LlmFormatOutput => ({
  positions: template.positions.map((position, index) => ({
    positionId: position.positionId,
    text: `${index}番目の本文です。そう受け取ることもできます。`,
  })),
  synthesis: "三枚をならべると、静かな移り変わりが見えてくるかもしれません。",
  closingQuestion: "いま、手放さずにいるものは何でしょうか。",
});

const portReturning = (output: LlmFormatOutput | null): FormatPort => ({
  format: async () => output,
});

const failingPort: FormatPort = {
  format: async () => {
    throw new Error("network");
  },
};

describe("mergeLlmOutput", () => {
  it("should replace the prose of every position", () => {
    const result = mergeLlmOutput(template, goodOutput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.positions.map((p) => p.text)).toEqual([
      "0番目の本文です。そう受け取ることもできます。",
      "1番目の本文です。そう受け取ることもできます。",
      "2番目の本文です。そう受け取ることもできます。",
    ]);
  });

  /**
   * モデルは本文しか書かない。カード名を間違えても画面には出ない、というのが
   * この差し込み方の効き目。
   */
  it("should keep card names, position labels and the spread label from the dictionary", () => {
    const result = mergeLlmOutput(template, goodOutput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.spreadLabel).toBe(template.spreadLabel);
    expect(result.reading.positions.map((p) => p.cardName)).toEqual(
      template.positions.map((p) => p.cardName),
    );
    expect(result.reading.positions.map((p) => p.positionLabel)).toEqual(
      template.positions.map((p) => p.positionLabel),
    );
  });

  it("should mark the reading as llm-rendered", () => {
    const result = mergeLlmOutput(template, goodOutput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.mode).toBe("llm");
  });

  it("should narrow the closing to the one question written for this draw", () => {
    const result = mergeLlmOutput(template, goodOutput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.closingQuestions).toEqual([
      "いま、手放さずにいるものは何でしょうか。",
    ]);
  });

  it("should reject the whole answer when a position is missing", () => {
    const output = goodOutput();
    const result = mergeLlmOutput(template, {
      ...output,
      positions: output.positions.slice(1),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual<Rejection>({
      reason: "missingPosition",
      at: "pos.past",
    });
  });

  it("should reject the whole answer when any text is blank", () => {
    const output = goodOutput();
    const result = mergeLlmOutput(template, { ...output, synthesis: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual<Rejection>({
      reason: "emptyText",
      at: "synthesis",
    });
  });

  it("should reject an answer that asserts the future", () => {
    const output = goodOutput();
    const result = mergeLlmOutput(template, {
      ...output,
      closingQuestion: "来月、必ず答えが見つかります。",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const rejection = result.rejections.find(
      (r) => r.at === "closingQuestion",
    );
    expect(rejection?.reason).toBe("toneViolation");
    expect(rejection?.violations?.[0]?.id).toBe("certainty.kanarazu");
  });
});

describe("createLlmRenderer", () => {
  it("should return the llm rendering when the answer is usable", async () => {
    const renderer = createLlmRenderer(portReturning(goodOutput()));

    const rendered = await renderer.render(source, "ja");

    expect(rendered.mode).toBe("llm");
  });

  it("should fall back to the template when there is no answer", async () => {
    const renderer = createLlmRenderer(portReturning(null));

    const rendered = await renderer.render(source, "ja");

    expect(rendered).toEqual(template);
  });

  /**
   * Issue #11 の完了条件「Function を意図的に落として、リーディングが最後まで
   * 読めることを確認」を、ネットワークなしで毎回踏むかたちにしたもの。
   */
  it("should still produce a complete reading when the port throws", async () => {
    const renderer = createLlmRenderer(failingPort);

    const rendered = await renderer.render(source, "ja");

    expect(rendered.mode).toBe("template");
    expect(rendered.positions).toHaveLength(3);
    expect(rendered.closingQuestions.length).toBeGreaterThan(0);
    expect(rendered.closingNote.length).toBeGreaterThan(0);
  });

  it("should report why an answer was thrown away", async () => {
    const rejections: Rejection[][] = [];
    const renderer = createLlmRenderer(
      portReturning({ ...goodOutput(), synthesis: "" }),
      { onRejected: (r) => rejections.push([...r]) },
    );

    const rendered = await renderer.render(source, "ja");

    expect(rendered.mode).toBe("template");
    expect(rejections[0]?.[0]?.reason).toBe("emptyText");
  });

  it("should report that the port was unreachable", async () => {
    const errors: unknown[] = [];
    const renderer = createLlmRenderer(failingPort, {
      onUnavailable: (error) => errors.push(error),
    });

    await renderer.render(source, "ja");

    expect(errors).toHaveLength(1);
  });
});
