import { describe, expect, it } from "vitest";
import { assertProfileMapsValid } from "./helpers";

describe("profile map validity partition 2", () => {
  it("validates generated maps for seeds 16 through 23", () => {
    expect(assertProfileMapsValid(16, 24).size).toBeGreaterThan(0);
  }, 120_000);
});
