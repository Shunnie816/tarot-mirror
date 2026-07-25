import { describe, expect, it } from "vitest";

import { createRng, generateSeed, shuffle } from "./random.js";

describe("createRng", () => {
  it("should produce the same sequence for the same seed", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    const take = (rng: () => number) => Array.from({ length: 10 }, rng);

    expect(take(b)).toEqual(take(a));
  });

  it("should produce a different sequence for a different seed", () => {
    const a = Array.from({ length: 10 }, createRng("seed-a"));
    const b = Array.from({ length: 10 }, createRng("seed-b"));

    expect(b).not.toEqual(a);
  });

  it("should stay within the [0, 1) range", () => {
    const rng = createRng("range");

    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it("should keep every element", () => {
    const shuffled = shuffle(items, createRng("s"));

    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("should not mutate the input array", () => {
    const original = [...items];
    shuffle(items, createRng("s"));

    expect(items).toEqual(original);
  });

  it("should produce the same order for the same seed", () => {
    expect(shuffle(items, createRng("s"))).toEqual(shuffle(items, createRng("s")));
  });

  it("should reorder the items", () => {
    expect(shuffle(items, createRng("s"))).not.toEqual(items);
  });
});

describe("generateSeed", () => {
  it("should produce a distinct seed on each call", () => {
    const seeds = new Set(Array.from({ length: 100 }, generateSeed));

    expect(seeds.size).toBe(100);
  });
});
