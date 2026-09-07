import { describe, expect, it } from "vitest";
import { assertProfileMapsValid } from "./helpers";

describe("profile map validity partition 0", () => {
  it("validates generated maps for seeds 0 through 7", () => {
    expect(assertProfileMapsValid(0, 8).size).toBeGreaterThan(0);
  }, 120_000);
});
