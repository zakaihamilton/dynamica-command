import { describe, it } from "vitest";
import { assertCampaignTopology } from "./helpers";

describe("all-seed topology partition 2", () => {
  it("covers seeds 4000-5999", () => assertCampaignTopology(4_000, 6_000), 15_000);
});
