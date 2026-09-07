import { describe, it } from "vitest";
import { assertCampaignTopology } from "./helpers";

describe("all-seed topology partition 3", () => {
  it("covers seeds 6000-7999", () => assertCampaignTopology(6_000, 8_000), 15_000);
});
