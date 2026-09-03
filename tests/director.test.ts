import { describe, expect, it } from "vitest";
import { createMission } from "../lib/sim/api";
import { directorTimeline, tickMissionDirector } from "../lib/sim/director";
import { createTutorialMission } from "../lib/sim/tutorial";
import { createCampaign } from "../lib/gen/campaign";

describe("mission director", () => {
  it("uses the full escort operation deadline for its finale", () => {
    const campaign = createCampaign(421);
    const mission = campaign.missions.find((item) => item.win.kind === "escort");
    expect(mission).toBeDefined();
    const state = createMission({ seed: 421, missionIndex: mission!.index });
    const runtime = state.runtime!;
    const timeline = directorTimeline(state);
    const expectedDuration = Math.max(state.tick + 360, runtime.deadline!);

    expect(timeline.finaleStart).toBe(Math.max(timeline.pressureStart + 360, Math.round(expectedDuration * 0.75)));
  });

  it("escalates a mission with deterministic reserve waves", () => {
    const state = createMission({ seed: 421, missionIndex: 0 });
    const director = state.runtime?.director;
    expect(director).toBeDefined();
    expect(director?.phase).toBe("opening");

    const beforePressure = state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length;
    state.tick = director!.pressureStart;
    const pressureEvents = tickMissionDirector(state);

    expect(state.runtime?.director?.phase).toBe("pressure");
    expect(state.runtime?.director?.eventCount).toBe(1);
    expect(state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length).toBeGreaterThan(beforePressure);
    expect(pressureEvents).toContainEqual({
      type: "alert",
      kind: "objective",
      text: "Enemy activity is rising — secure the resource lanes.",
    });

    const beforeFinale = state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length;
    state.tick = director!.finaleStart;
    const finaleEvents = tickMissionDirector(state);

    expect(state.runtime?.director?.phase).toBe("finale");
    expect(state.runtime?.director?.eventCount).toBe(2);
    expect(state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length).toBeGreaterThan(beforeFinale);
    expect(finaleEvents).toHaveLength(1);
    expect(finaleEvents[0]).toMatchObject({ type: "alert", kind: "objective" });
    expect(finaleEvents[0]).toMatchObject({ text: expect.stringMatching(/Final enemy push|regrouping around/) });
  });

  it("does not repeat a phase event after a save is ticked again", () => {
    const state = createMission({ seed: 421, missionIndex: 0 });
    const director = state.runtime!.director!;
    state.tick = director.pressureStart;

    expect(tickMissionDirector(state)).toHaveLength(1);
    expect(tickMissionDirector(state)).toEqual([]);
    expect(state.runtime!.director!.eventCount).toBe(1);
  });

  it("does not run director events during tutorial training, including legacy state", () => {
    const state = createTutorialMission();
    expect(state.runtime?.director).toBeUndefined();

    const runtime = state.runtime!;
    runtime.director = {
      phase: "opening",
      pressureStart: 720,
      finaleStart: 2700,
      eventCount: 0,
    };
    const beforeUnits = state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length;
    state.tick = runtime.director.finaleStart;

    expect(tickMissionDirector(state)).toEqual([]);
    expect(runtime.director.phase).toBe("opening");
    expect(runtime.director.eventCount).toBe(0);
    expect(state.entities.filter((entity) => entity.owner === 1 && entity.class === "unit").length).toBe(beforeUnits);
  });
});
