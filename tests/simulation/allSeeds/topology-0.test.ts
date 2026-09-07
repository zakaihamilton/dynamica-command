import { describe, it } from "vitest";
import { assertCampaignTopology } from "./helpers";

describe("all-seed topology partition 0", () => {
  it("covers seeds 0-1999", () => assertCampaignTopology(0, 2_000), 15_000);
});
