import { describe, expect, it, vi } from "vitest";
import { createCamera } from "../lib/iso";
import { UNIT_STATS } from "../lib/catalog";
import { COMMAND_MARKER_COLORS, commandMarkerKind, drawCommandMarker } from "../lib/render/renderOverlays";
import { drawCombatEffects } from "../lib/render/renderCombat";
import { addUnit, makeFixture } from "../lib/sim/fixtures";

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineCap: "butt",
    canvas: { width: 400, height: 300 },
  } as unknown as CanvasRenderingContext2D;
}

describe("command markers", () => {
  it("maps order types onto attack, harvest, support, and move kinds", () => {
    expect(commandMarkerKind([{ type: "attack" }])).toBe("attack");
    expect(commandMarkerKind([{ type: "attackMove" }])).toBe("attack");
    expect(commandMarkerKind([{ type: "harvest" }])).toBe("harvest");
    expect(commandMarkerKind([{ type: "support" }])).toBe("support");
    expect(commandMarkerKind([{ type: "move" }])).toBe("move");
    expect(commandMarkerKind([{ type: "build" }])).toBeNull();
  });

  it("paints each command-marker kind in its own color", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const cam = createCamera();
    for (const kind of ["move", "attack", "harvest", "support"] as const) {
      const ctx = mockCtx();
      drawCommandMarker(ctx, state, cam, { x: 2, y: 2, bornMs: 0, kind }, 80);
      expect(ctx.strokeStyle).toBe(COMMAND_MARKER_COLORS[kind].stroke);
      expect(ctx.fillStyle).toBe(COMMAND_MARKER_COLORS[kind].fill);
    }
  });
});

describe("combat tracers", () => {
  it("strokes tracers for a non-empty attacking draw list and skips an empty list", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const attacker = addUnit(state, 0, "infantry", 2, 2);
    const target = addUnit(state, 1, "infantry", 4, 2);
    attacker.attackTarget = target.id;
    attacker.cooldown = UNIT_STATS.infantry.cooldown;
    const cam = createCamera();
    const byId = new Map(state.entities.map((entity) => [entity.id, entity]));

    const empty = mockCtx();
    drawCombatEffects(empty, state, cam, [], byId, () => 0);
    expect(empty.stroke).not.toHaveBeenCalled();

    const armed = mockCtx();
    drawCombatEffects(armed, state, cam, [attacker], byId, () => 0);
    expect(armed.stroke).toHaveBeenCalled();
  });
});
