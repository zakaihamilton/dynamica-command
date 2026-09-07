import { describe, expect, it } from "vitest";
import { createMission, tick } from "../../../lib/sim/api";
import { ArchetypeCommander } from "../../../lib/sim/commander/archetypes";
import { simulationFingerprint } from "../../../lib/sim/replay";

describe("headless balance long horizons", () => {
  it("match long-running reference transitions", () => {
    for (const strategy of ["rush", "turtle", "greed", "infantry", "vehicles"] as const) {
      const reference = createMission({ seed: 421, missionIndex: 5 });
      const headless = structuredClone(reference);
      const referenceCommander = new ArchetypeCommander(strategy);
      const headlessCommander = new ArchetypeCommander(strategy);

      for (let i = 0; i < 1_200 && reference.result === "playing"; i += 1) {
        const referenceCommands = referenceCommander.plan(reference);
        const headlessCommands = headlessCommander.plan(headless);
        expect(headlessCommands).toEqual(referenceCommands);
        const referenceTick = tick(reference, referenceCommands);
        const headlessTick = tick(headless, headlessCommands, { collectEvents: false, updateFog: false });
        expect(headlessTick.commandRejections).toBe(referenceTick.commandRejections);
        expect(simulationFingerprint(headless)).toBe(simulationFingerprint(reference));
      }
    }
  }, 120_000);
});
