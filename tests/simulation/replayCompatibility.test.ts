import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runReplay } from "../../lib/sim/replay";

const BASELINES = [
  { kind: "annihilate", seed: 1, missionIndex: 2, digest: "b3681507b20b0118eb8de21993f5133cd71458cf6a04d7907bb4f8b2544b6bb7" },
  { kind: "decapitate", seed: 1, missionIndex: 4, digest: "ecb5e56f0bfb0dee67ff47bad3a3f8a6116d062c4f6ad635777db0069f0201a8" },
  { kind: "destroyMarked", seed: 0, missionIndex: 3, digest: "e0ade930976a05b828a0e50069720925a3cc5de00da2bcdae6d2c21aae226a89" },
  { kind: "escort", seed: 0, missionIndex: 2, digest: "d1b0a4993a324a363058ce269a4969a2f7df63132d94f2fbd571069ac9381e74" },
  { kind: "extraction", seed: 0, missionIndex: 1, digest: "4377ac12c98d24652ca544e1ba7d40ad26a23534c12055dfc662d2ad33c98be9" },
  { kind: "forceQuota", seed: 0, missionIndex: 4, digest: "8ee9b7f0f55348be0a37aa0dff143f31c97c3bc5e038e21a72842a53654cb224" },
  { kind: "harvestQuota", seed: 7, missionIndex: 3, digest: "11ee3254605d96cfb71862caa42cc6ae7d8c6d446160e5deda266451bc3a1971" },
  { kind: "holdTheLine", seed: 0, missionIndex: 5, digest: "9bbf331ea885ff967c231e22ca4aa3009a4177256fba87a60eb43665addb5bac" },
  { kind: "razeAll", seed: 3, missionIndex: 2, digest: "07b7984626528519d55affc793b27b6632f6ad7f042f5e54dbc98039ae89c151" },
  { kind: "rescue", seed: 0, missionIndex: 0, digest: "d7366736af89f6f7175a95992dc4521658f35c08f33119247edf5c844f4e88c7" },
  { kind: "sabotage", seed: 1, missionIndex: 0, digest: "036644ad6e7eeb5a55fce3a2f70455d7d0f8d00e57ba5f43dc71f66837b13e62" },
  { kind: "structureQuota", seed: 2, missionIndex: 0, digest: "d90a775c64185a5c298a243a09fd1bc949bbc249b668b1267e0469f5532f1697" },
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
