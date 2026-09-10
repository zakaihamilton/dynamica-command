import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runReplay } from "../../lib/sim/replay";

const BASELINES = [
  { kind: "annihilate", seed: 1, missionIndex: 2, digest: "76b8629c4bae4d449aa7bd7661a632b6be53d3a4c491887d81da74ec223d4d4e" },
  { kind: "decapitate", seed: 1, missionIndex: 4, digest: "ecb5e56f0bfb0dee67ff47bad3a3f8a6116d062c4f6ad635777db0069f0201a8" },
  { kind: "destroyMarked", seed: 0, missionIndex: 3, digest: "e0ade930976a05b828a0e50069720925a3cc5de00da2bcdae6d2c21aae226a89" },
  { kind: "escort", seed: 0, missionIndex: 2, digest: "d1b0a4993a324a363058ce269a4969a2f7df63132d94f2fbd571069ac9381e74" },
  { kind: "extraction", seed: 0, missionIndex: 1, digest: "0f5b8676fbc5a99c77da9dd1672067cbf3318dd1745f68d5dafd06c080077cd9" },
  { kind: "forceQuota", seed: 0, missionIndex: 4, digest: "83e99ec4b81b94bffc7aaaebac1563a1bbdc1a3b0a7fba0dc408fbcb4d49c141" },
  { kind: "harvestQuota", seed: 7, missionIndex: 3, digest: "c03a108b7573486bb2b773e2b4c911edbf97545e0d24887a18e8854d0caaadf3" },
  { kind: "holdTheLine", seed: 0, missionIndex: 5, digest: "9bbf331ea885ff967c231e22ca4aa3009a4177256fba87a60eb43665addb5bac" },
  { kind: "razeAll", seed: 3, missionIndex: 2, digest: "ec708d8352b04cf4645ffca37358567fb3629a1a1ecef53a3ca507671a7ddf79" },
  { kind: "rescue", seed: 0, missionIndex: 0, digest: "4e24b771ce14d44d8d135de5d3ac2182b975f280c673254f86c0eaa9c4777a10" },
  { kind: "sabotage", seed: 1, missionIndex: 0, digest: "036644ad6e7eeb5a55fce3a2f70455d7d0f8d00e57ba5f43dc71f66837b13e62" },
  { kind: "structureQuota", seed: 2, missionIndex: 0, digest: "b3eabb157fdcf77b746fa247e9202ff46d06145a49794a54a930429e22463681" },
] as const;

describe("replay compatibility baselines", () => {
  it("keeps representative fingerprints stable across every mission kind", () => {
    for (const baseline of BASELINES) {
      const replay = runReplay({ seed: baseline.seed, missionIndex: baseline.missionIndex, maxTicks: 120 });
      const digest = createHash("sha256").update(replay.fingerprint).digest("hex");
      expect({ kind: replay.state.win.kind, tick: replay.state.tick, result: replay.terminalResult, digest }).toEqual({
        kind: baseline.kind,
        tick: 120,
        result: "playing",
        digest: baseline.digest,
      });
    }
  });
});
