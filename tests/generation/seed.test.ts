import { describe, expect, it } from "vitest";
import { parseMissionIndex } from "../../lib/seed/rng";

describe("mission query parsing", () => {
  it("accepts only the six campaign mission indices", () => {
    expect(parseMissionIndex("0")).toBe(0);
    expect(parseMissionIndex("05")).toBe(5);
    expect(parseMissionIndex("6")).toBeNull();
  });

  it("rejects malformed values instead of producing NaN or invalid missions", () => {
    for (const value of [null, undefined, "", "-1", "1.5", "abc", "100"]) {
      expect(parseMissionIndex(value)).toBeNull();
    }
  });
});
