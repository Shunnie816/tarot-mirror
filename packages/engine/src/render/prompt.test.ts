import {
  BANNED_PHRASES,
  getResolver,
  SANCTIONED_HEDGES,
} from "@tarot-mirror/content";
import { riderWaite } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import { RELATIONSHIP_8, THREE_CARDS } from "../spreads";
import { createReading } from "../synthesize";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { renderTemplate } from "./template";

/**
 * 観点
 *
 * 1. システムプロンプトは tone.ts と同じ規律を渡している（言うことと検証が同じ）
 * 2. システムプロンプトは引きに依存しない（キャッシュと版管理の前提）
 * 3. 素材は日本語で渡り、ID が生のまま漏れない
 * 4. positionId だけは生のまま渡る（返答の鍵になるため）
 * 5. **テンプレートの完成文は渡さない**（言い換え装置にしない）
 * 6. 問い・重なり・side の有無で伝え方が変わる
 */

const reading = (seed: string, spread = THREE_CARDS, question?: string) =>
  createReading({
    spread,
    deck: riderWaite,
    seed,
    ...(question !== undefined ? { question } : {}),
    now: () => new Date("2026-07-25T00:00:00.000Z"),
  });

describe("buildSystemPrompt", () => {
  it("should quote every banned wording the validator checks for", () => {
    const system = buildSystemPrompt("ja");

    for (const phrase of BANNED_PHRASES) {
      for (const example of phrase.examples) {
        expect(system).toContain(example);
      }
    }
  });

  it("should quote the sanctioned hedges rather than paraphrase them", () => {
    const system = buildSystemPrompt("ja");

    for (const hedge of SANCTIONED_HEDGES) {
      expect(system).toContain(hedge);
    }
  });

  it("should describe every lens the spreads can use", () => {
    const system = buildSystemPrompt("ja");

    for (const lens of ["origin", "currentState", "trajectory", "catalyst"]) {
      expect(system).toContain(`${lens}:`);
    }
  });

  it("should not depend on the reading, so it is identical for every draw", () => {
    expect(buildSystemPrompt("ja")).toBe(buildSystemPrompt("ja"));
  });
});

describe("buildUserPrompt", () => {
  it("should pass keywords as Japanese words, not as ids", () => {
    const source = reading("s");
    const resolver = getResolver("ja");
    const user = buildUserPrompt(source);

    expect(user).not.toMatch(/kw\./);
    for (const position of source.positions) {
      for (const keyword of position.keywords) {
        expect(user).toContain(resolver.keyword(keyword));
      }
    }
  });

  it("should pass position ids verbatim so the answer can be keyed by them", () => {
    const user = buildUserPrompt(reading("s"));

    expect(user).toContain("pos.past");
    expect(user).toContain("pos.present");
    expect(user).toContain("pos.future");
  });

  /**
   * これが Phase 9 の一番きわどい線。完成文を渡した瞬間、LLM は言い換え装置に
   * なり、一貫性もコスト削減も失われる（PROJECT_OVERVIEW / CONTRIBUTING §1）。
   * モデルが受け取ってよいのは読み筋とキーワードまで。
   */
  it("should not hand the model the template's finished sentences", () => {
    const source = reading("s");
    const user = buildUserPrompt(source);

    for (const position of renderTemplate(source).positions) {
      expect(user).not.toContain(position.text);
    }
  });

  it("should include the user's question when there is one", () => {
    const user = buildUserPrompt(reading("s", THREE_CARDS, "転職するか迷う"));

    expect(user).toContain("転職するか迷う");
  });

  it("should say plainly that no question was written when there is none", () => {
    const user = buildUserPrompt(reading("s"));

    expect(user).toContain("問いは書かれていません");
  });

  it("should say which side a position belongs to in a two-sided spread", () => {
    const user = buildUserPrompt(reading("s", RELATIONSHIP_8));

    expect(user).toContain("あなた");
    expect(user).toContain("相手");
  });

  it("should pass each insight with the positions it was grounded in", () => {
    const source = reading("phase9-sample");
    const user = buildUserPrompt(source);

    expect(source.insights.length).toBeGreaterThan(0);
    for (const insight of source.insights) {
      expect(user).toContain(insight.subjects.join(", "));
    }
  });

  it("should resolve every id it passes through the dictionary", () => {
    const user = buildUserPrompt(reading("s", RELATIONSHIP_8, "問い"));

    expect(user).not.toMatch(/insight\./);
    expect(user).not.toMatch(/framing\./);
    expect(user).not.toMatch(/\bq\.\w/);
  });
});
