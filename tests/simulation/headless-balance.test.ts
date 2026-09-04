import { describe, expect, it } from "vitest";
import { createMission, tick } from "../../lib/sim/api";
import { ArchetypeCommander } from "../../lib/sim/commander/archetypes";
import { stratifiedBalanceScenarios } from "../../lib/sim/balanceRunner";

function withoutFog(state: ReturnType<typeof createMission>) {
  const { fog: _fog, ...outcomeState } = state;
  void _fog;
  return outcomeState;
}

describe("headless balance ticks", () => {
  it("match the event-producing reference state transitions", () => {
    const reference = createMission({ seed: 7, missionIndex: 3 });
    const headless = structuredClone(reference);
    const referenceCommander = new ArchetypeCommander("rush");
    const headlessCommander = new ArchetypeCommander("rush");

    for (let i = 0; i < 240 && reference.result === "playing"; i += 1) {
      const referenceCommands = referenceCommander.plan(reference);
      const headlessCommands = headlessCommander.plan(headless);
      expect(headlessCommands).toEqual(referenceCommands);

      tick(reference, referenceCommands);
      tick(headless, headlessCommands, { collectEvents: false, updateFog: false });
      expect(withoutFog(headless)).toEqual(withoutFog(reference));
    }
  });

  it("matches the reference transitions for every mission kind", () => {
    const scenarios = stratifiedBalanceScenarios(0, 39, 1);

    for (const { seed, mission } of scenarios) {
      const strategies = ["rush", "turtle", "greed", "infantry", "vehicles"] as const;
      for (const strategy of strategies) {
        const reference = createMission({ seed, missionIndex: mission });
        const headless = structuredClone(reference);
        const referenceCommander = new ArchetypeCommander(strategy);
        const headlessCommander = new ArchetypeCommander(strategy);

        for (let i = 0; i < 180 && reference.result === "playing"; i += 1) {
          const referenceCommands = referenceCommander.plan(reference);
          const headlessCommands = headlessCommander.plan(headless);
          expect(headlessCommands).toEqual(referenceCommands);

          const referenceTick = tick(reference, referenceCommands);
          const headlessTick = tick(headless, headlessCommands, { collectEvents: false, updateFog: false });
          expect(headlessTick.commandRejections).toBe(referenceTick.commandRejections);
          expect(withoutFog(headless)).toEqual(withoutFog(reference));
        }
      }
    }
  }, 120_000);

  it("matches long-running reference transitions", () => {
    for (const strategy of ["rush", "turtle", "greed", "infantry", "vehicles"] as const) {
      const reference = createMission({ seed: 421, missionIndex: 7 });
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
        expect(withoutFog(headless)).toEqual(withoutFog(reference));
      }
    }
  });
});
