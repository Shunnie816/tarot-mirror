import { getCard } from "@tarot-mirror/decks";
import { describe, expect, it } from "vitest";

import {
  applyReversal,
  framingIdFor,
  interpretDraw,
  interpretPosition,
  selectKeywords,
} from "./interpret";
import { THREE_CARDS } from "./spreads";
import type { SpreadPosition } from "./types";

const fool = getCard("rw.major.00");
const devil = getCard("rw.major.15");

describe("applyReversal", () => {
  it("should turn attention inward", () => {
    const axes = { agency: 0, tempo: 0, friction: 0, focus: 0 };

    expect(applyReversal(axes).focus).toBe(1);
  });

  it("should slow tempo and raise friction", () => {
    const axes = { agency: 0, tempo: 1, friction: 1, focus: 0 };
    const reversed = applyReversal(axes);

    expect(reversed.tempo).toBe(0);
    expect(reversed.friction).toBe(2);
  });

  it("should reduce agency", () => {
    const axes = { agency: 2, tempo: 0, friction: 0, focus: 0 };

    expect(applyReversal(axes).agency).toBe(1);
  });

  it("should clamp each axis to its declared range", () => {
    const extreme = { agency: -2, tempo: -2, friction: 4, focus: 2 };
    const reversed = applyReversal(extreme);

    expect(reversed).toEqual({ agency: -2, tempo: -2, friction: 4, focus: 2 });
  });

  it("should not mutate the input axes", () => {
    const axes = { agency: 1, tempo: 1, friction: 1, focus: 1 };
    applyReversal(axes);

    expect(axes).toEqual({ agency: 1, tempo: 1, friction: 1, focus: 1 });
  });
});

describe("selectKeywords", () => {
  it("should use the upright keyword set for an upright card", () => {
    const selected = selectKeywords(fool, "upright", "currentState");

    expect(selected.every((kw) => fool.keywords.upright.includes(kw))).toBe(true);
  });

  it("should use the reversed keyword set for a reversed card", () => {
    const selected = selectKeywords(fool, "reversed", "currentState");

    expect(selected.every((kw) => fool.keywords.reversed.includes(kw))).toBe(true);
  });

  it("should return at most three keywords", () => {
    expect(selectKeywords(fool, "upright", "currentState")).toHaveLength(3);
  });

  it("should lead with a different keyword depending on the lens", () => {
    const asCurrentState = selectKeywords(fool, "upright", "currentState");
    const asAdvice = selectKeywords(fool, "upright", "advice");

    expect(asAdvice[0]).not.toBe(asCurrentState[0]);
  });

  it("should return the same keywords for the same inputs", () => {
    expect(selectKeywords(devil, "reversed", "catalyst")).toEqual(
      selectKeywords(devil, "reversed", "catalyst"),
    );
  });
});

describe("framingIdFor", () => {
  it("should derive the framing key from lens and orientation", () => {
    expect(framingIdFor("origin", "reversed")).toBe("framing.origin.reversed");
  });
});

describe("interpretPosition", () => {
  const position: SpreadPosition = { id: "pos.present", lens: "currentState" };

  it("should carry the card's own axes through when upright", () => {
    const reading = interpretPosition(fool, "upright", position);

    expect(reading.axes).toEqual(fool.axes);
  });

  it("should apply the reversal transform when reversed", () => {
    const reading = interpretPosition(fool, "reversed", position);

    expect(reading.axes).toEqual(applyReversal(fool.axes));
  });

  it("should record the position's group when the spread declares one", () => {
    const reading = interpretPosition(fool, "upright", {
      id: "pos.self.present",
      lens: "currentState",
      group: "self",
    });

    expect(reading.group).toBe("self");
  });

  it("should omit group entirely when the position has none", () => {
    const reading = interpretPosition(fool, "upright", position);

    expect("group" in reading).toBe(false);
  });
});

describe("interpretDraw", () => {
  const drawn = [
    { positionId: "pos.past", cardId: "rw.major.00", orientation: "upright" },
    { positionId: "pos.present", cardId: "rw.major.15", orientation: "reversed" },
    { positionId: "pos.future", cardId: "rw.major.21", orientation: "upright" },
  ] as const;

  it("should return one reading per spread position, in spread order", () => {
    const readings = interpretDraw(THREE_CARDS, drawn);

    expect(readings.map((r) => r.positionId)).toEqual([
      "pos.past",
      "pos.present",
      "pos.future",
    ]);
  });

  it("should apply each position's own lens", () => {
    const readings = interpretDraw(THREE_CARDS, drawn);

    expect(readings.map((r) => r.lens)).toEqual([
      "origin",
      "currentState",
      "trajectory",
    ]);
  });

  it("should throw when a spread position has no drawn card", () => {
    expect(() => interpretDraw(THREE_CARDS, drawn.slice(0, 2))).toThrow(
      /No card drawn for position "pos.future"/,
    );
  });
});
