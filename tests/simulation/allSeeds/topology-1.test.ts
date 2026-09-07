import { describe, it } from "vitest";
import { assertCampaignTopology } from "./helpers";

describe("all-seed topology partition 1", () => {
  it("covers seeds 2000-3999", () => assertCampaignTopology(2_000, 4_000), 15_000);
});
