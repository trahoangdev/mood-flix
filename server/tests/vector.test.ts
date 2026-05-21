import { describe, expect, it } from "vitest";
import { averageVectors, normalizeScore } from "../src/utils/vector";

describe("vector utilities", () => {
  it("averages vectors by dimension", () => {
    expect(
      averageVectors([
        [1, 3, 5],
        [3, 5, 7],
      ]),
    ).toEqual([2, 4, 6]);
  });

  it("rejects vectors with different dimensions", () => {
    expect(() => averageVectors([[1, 2], [3]])).toThrow(
      "Cannot average vectors with different dimensions",
    );
  });

  it("normalizes scores into the 0..1 range", () => {
    expect(normalizeScore(5, 10)).toBe(0.5);
    expect(normalizeScore(15, 10)).toBe(1);
    expect(normalizeScore(-5, 10)).toBe(0);
    expect(normalizeScore(undefined, 10)).toBe(0);
  });
});
