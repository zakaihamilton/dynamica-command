import { describe, expect, it } from "vitest";
import { assertProfileMapsValid } from "./helpers";

describe("profile map validity partition 1", () => {
  it("validates generated maps for seeds 8 through 15", () => {
    expect(assertProfileMapsValid(8, 16).size).toBeGreaterThan(0);
  }, 120_000);
});
