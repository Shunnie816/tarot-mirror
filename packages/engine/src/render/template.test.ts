import { findToneViolations } from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { ONE_CARD, RELATIONSHIP_8, THREE_CARDS } from "../spreads.js";
import { createReading } from "../synthesize.js";
import { renderTemplate, toPlainText } from "./template.js";

const reading = (seed: string, spread = THREE_CARDS, question?: string) =>
  createReading({
    spread,
    deck: riderWaite,
    seed,
    ...(question !== undefined ? { question } : {}),
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

describe("renderTemplate", () => {
  it("should render one section per drawn position", () => {
    const rendered = renderTemplate(reading("s"));

    expect(rendered.positions).toHaveLength(3);
  });

  it("should label each position, card and orientation in Japanese", () => {
    const rendered = renderTemplate(reading("s"));
    const first = rendered.positions[0]!;

    expect(first.positionLabel).toBe("これまで");
    expect(first.cardName).not.toMatch(/^rw\./);
    expect(["正位置", "逆位置"]).toContain(first.orientationLabel);
  });

  it("should resolve every keyword into the framing sentence", () => {
    const rendered = renderTemplate(reading("s"));

    for (const position of rendered.positions) {
      expect(position.text).not.toMatch(/kw\./);
      expect(position.text).not.toMatch(/\{keywords\}/);
    }
  });

  it("should carry the user's question through to the rendering", () => {
    const rendered = renderTemplate(reading("s", THREE_CARDS, "この関係をどうしたいか"));

    expect(rendered.question).toBe("この関係をどうしたいか");
  });

  it("should mark itself as template-rendered", () => {
    expect(renderTemplate(reading("s")).mode).toBe("template");
  });
});

/**
 * The point of the template renderer: a complete, readable reading with no
 * network and no API key. These are the regression tests that keep the LLM
 * optional — if they break, the cost strategy breaks with them.
 */
describe("rendering without an LLM", () => {
  it("should produce a complete reading for every spread across many seeds", () => {
    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      for (let i = 0; i < 100; i++) {
        const rendered = renderTemplate(reading(`no-llm-${i}`, spread));

        expect(rendered.positions).toHaveLength(spread.positions.length);
        expect(rendered.synthesis.length).toBeGreaterThan(0);
        expect(rendered.closingQuestions.length).toBeGreaterThan(0);
        expect(rendered.closingNote.length).toBeGreaterThan(0);
      }
    }
  });

  it("should still say something when no cross-card rule fired", () => {
    const empty = { ...reading("s"), insights: [] };

    const rendered = renderTemplate(empty);

    expect(rendered.synthesis).toHaveLength(1);
    expect(rendered.synthesis[0]).toContain("目立った重なりは見当たりません");
  });

  it("should never leave an unresolved id in the output", () => {
    for (let i = 0; i < 100; i++) {
      const text = toPlainText(renderTemplate(reading(`ids-${i}`, RELATIONSHIP_8)));

      expect(text).not.toMatch(/\b(kw|q|insight|framing|pos|ui|spread|rw)\./);
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});

/**
 * Core Principle #1, enforced end to end: not just the dictionary strings in
 * isolation, but the assembled reading a user actually reads.
 */
describe("rendered readings and tone", () => {
  it("should contain no deterministic phrasing across many generated readings", () => {
    const offenders: Array<{ seed: string; violations: unknown[] }> = [];

    for (const spread of [ONE_CARD, THREE_CARDS, RELATIONSHIP_8]) {
      for (let i = 0; i < 100; i++) {
        const seed = `${spread.id}-${i}`;
        const text = toPlainText(renderTemplate(reading(seed, spread)));
        const violations = findToneViolations(text);
        if (violations.length > 0) offenders.push({ seed, violations });
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("toPlainText", () => {
  it("should include the spread name, every card and the closing note", () => {
    const rendered = renderTemplate(reading("s"));
    const text = toPlainText(rendered);

    expect(text).toContain(rendered.spreadLabel);
    for (const position of rendered.positions) {
      expect(text).toContain(position.cardName);
    }
    expect(text).toContain(rendered.closingNote);
  });

  it("should include the question heading only when a question was asked", () => {
    const withQuestion = toPlainText(renderTemplate(reading("s", THREE_CARDS, "問い")));
    const without = toPlainText(renderTemplate(reading("s")));

    expect(withQuestion).toContain("あなたの問い");
    expect(without).not.toContain("あなたの問い");
  });
});
