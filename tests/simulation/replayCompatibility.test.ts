import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runReplay } from "../../lib/sim/replay";

const BASELINES = [
  { kind: "annihilate", seed: 1, missionIndex: 2, digest: "a7778eaa0d490048f01feb7dbe764a8ed8027157cade385a65318dc3cade5082" },
  { kind: "decapitate", seed: 1, missionIndex: 4, digest: "1f91b716d413f5d7e38fe0594f2dbd91ebdcca1f0bb1b2fecd89c343c28f7c88" },
  { kind: "destroyMarked", seed: 0, missionIndex: 3, digest: "3163c1aa667d253378f1151011c67221789b27dd49c9e45d26b32ba9cea27c65" },
  { kind: "escort", seed: 0, missionIndex: 2, digest: "529fb67ce6525db3d7e5b38be23a3095cbc802f1c36f5bd427038f4f35b85746" },
  { kind: "extraction", seed: 0, missionIndex: 1, digest: "5022c0b80323ba1be2f9e7aa954d398d356f2123384f70a40f682e8da800c111" },
  { kind: "forceQuota", seed: 0, missionIndex: 4, digest: "2dd8ca2e5b255499829ddd491398badf38619521cabd2a42b246715df4063a7a" },
  { kind: "harvestQuota", seed: 7, missionIndex: 3, digest: "2ef3b18591122e986258a7760fed54478714d89ca471c08aa7d781e04111b294" },
  { kind: "holdTheLine", seed: 0, missionIndex: 5, digest: "1709546e3006c6b3312e62f0bfee5b271e1577df8a2cbfb6ab1aeba0698465be" },
  { kind: "razeAll", seed: 3, missionIndex: 2, digest: "149ac9b6b6c99e3d1e2efc46430ed97f6a476c354a0d58451e599fc33bdc0d02" },
  { kind: "rescue", seed: 0, missionIndex: 0, digest: "b4c7c003a09944563f2de154b8f7813db79450fdd469e66af4da09922fa399c8" },
  { kind: "sabotage", seed: 1, missionIndex: 0, digest: "580e555d953c6e789422fd76b6a42ab8f2c953ef2471e561a34baa26219900cc" },
  { kind: "structureQuota", seed: 2, missionIndex: 0, digest: "c6fc6cf9ba8add87cc835fd394ab457602533155d0dce468c4d25b47d818dd85" },
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
