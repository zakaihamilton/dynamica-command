import { describe, it } from "vitest";
import { assertCampaignTopology } from "./helpers";

describe("all-seed topology partition 4", () => {
  it("covers seeds 8000-9999", () => assertCampaignTopology(8_000, 10_000), 15_000);
});
