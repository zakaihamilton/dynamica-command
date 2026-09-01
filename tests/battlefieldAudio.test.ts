import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchBattlefieldAudio } from "../lib/audio/battlefield";
import { playSfx } from "../lib/audio/synth";
import { createCamera } from "../lib/iso";

vi.mock("../lib/audio/synth", () => ({
  playSfx: vi.fn(),
}));

const play = vi.mocked(playSfx);

function onScreenCamera() {
  const camera = createCamera();
  camera.x = 400;
  camera.y = 80;
  return camera;
}

describe("battlefield audio dispatch", () => {
  beforeEach(() => {
    play.mockClear();
  });

  it("plays spatial combat and impact cues", () => {
    dispatchBattlefieldAudio(
      [{
        type: "combat",
        owner: 0,
        weapon: "cannon",
        x: 6,
        y: 6,
        targetX: 6,
        targetY: 6,
        targetOwner: 1,
        targetKind: "infantry",
        destroyed: false,
      }],
      onScreenCamera(),
      800,
      500,
    );
    expect(play).toHaveBeenCalledWith("cannon", expect.objectContaining({ pan: expect.any(Number), gain: expect.any(Number) }));
    expect(play).toHaveBeenCalledWith("impact", expect.objectContaining({ pan: expect.any(Number) }));
  });

  it("plays a heavier destruction cue for buildings", () => {
    dispatchBattlefieldAudio(
      [{ type: "destroyed", id: 3, owner: 1, kind: "power", x: 6, y: 6 }],
      onScreenCamera(),
      800,
      500,
    );
    expect(play).toHaveBeenCalledWith("destruction", expect.objectContaining({ heavy: true }));
  });

  it("plays credit, power, and deadline cues for the player", () => {
    dispatchBattlefieldAudio(
      [
        { type: "credits", owner: 0, amount: 40 },
        { type: "credits", owner: 1, amount: 40 },
        { type: "powerShortage", owner: 0 },
        { type: "deadlineWarning", remainingTicks: 360 },
      ],
      onScreenCamera(),
      800,
      500,
    );
    expect(play).toHaveBeenCalledWith("credits");
    expect(play).toHaveBeenCalledWith("powerShortage");
    expect(play).toHaveBeenCalledWith("deadline", { force: true });
    expect(play.mock.calls.filter((call) => call[0] === "credits")).toHaveLength(1);
  });
});
