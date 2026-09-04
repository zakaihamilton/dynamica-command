import { describe, expect, it } from "vitest";
import { createMission, tick } from "../../lib/sim/api";
import { ArchetypeCommander } from "../../lib/sim/commander/archetypes";

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
});
