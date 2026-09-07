import { describe, expect, it } from "vitest";
import { assertProfileMapsValid } from "./helpers";

describe("profile map validity partition 3", () => {
  it("validates generated maps for seeds 24 through 31", () => {
    expect(assertProfileMapsValid(24, 32).size).toBeGreaterThan(0);
  }, 120_000);
});
