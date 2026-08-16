import { describe, expect, it } from "vitest";
import { deserializeState, listSaves, memoryStorage, readSave, serializeState, writeSave } from "../lib/persist/save";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { tick } from "../lib/sim/api";

describe("persist", () => {
  it("round-trips a save through memory storage", () => {
    const s = makeFixture({ seed: 421, win: { kind: "harvestQuota", target: 9000 } });
    addBuilding(s, 0, "constructionYard", 1, 1);
    tick(s);
    tick(s);
    const storage = memoryStorage();
    writeSave(storage, s);
    const loaded = readSave(storage, 421);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(s.tick);
    expect(loaded!.credits[0]).toBe(s.credits[0]);
    expect(loaded!.win.kind).toBe("harvestQuota");
    const listed = listSaves(storage);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.seed).toBe("0421");
  });

  it("backfills biome and surface metadata in legacy saves", () => {
    const legacy = makeFixture({ seed: 77, win: { kind: "annihilate" } }) as Partial<ReturnType<typeof makeFixture>>;
    delete legacy.biome;
    delete legacy.surfaces;
    const loaded = deserializeState(JSON.stringify(legacy));
    expect(loaded.biome).toBeTruthy();
    expect(loaded.surfaces).toHaveLength(loaded.width * loaded.height);
    expect(new Set(loaded.surfaces)).toEqual(new Set([0]));
  });

  it("expands legacy fog grids to cover the map skirt", () => {
    const s = makeFixture({ seed: 77, win: { kind: "annihilate" } });
    const raw = JSON.parse(serializeState(s)) as { fog: number[]; width: number; height: number };
    raw.fog = new Array(s.width * s.height).fill(1);
    const loaded = deserializeState(JSON.stringify(raw));
    expect(loaded.fog.length).toBeGreaterThan(s.width * s.height);
    expect(loaded.fog[0]).toBe(0);
  });

  it("round-trips a production queue and backfills missing queues", () => {
    const s = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const barracks = addBuilding(s, 0, "barracks", 2, 2);
    barracks.producing = { kind: "infantry", remaining: 40 };
    barracks.queue = ["infantry", "antiArmor"];
    const storage = memoryStorage();
    writeSave(storage, s);
    const loaded = readSave(storage, 421);
    expect(loaded?.entities[0]?.producing).toEqual({ kind: "infantry", remaining: 40 });
    expect(loaded?.entities[0]?.queue).toEqual(["infantry", "antiArmor"]);

    const raw = JSON.parse(serializeState(s)) as { entities: { queue?: string[] }[] };
    delete raw.entities[0]!.queue;
    const backfilled = deserializeState(JSON.stringify(raw));
    expect(backfilled.entities[0]?.queue).toEqual([]);
  });

  it("backfills facing on legacy entities", () => {
    const s = makeFixture({ seed: 9, win: { kind: "annihilate" } });
    addUnit(s, 0, "infantry", 1, 1);
    addUnit(s, 1, "tank", 3, 3);
    const raw = JSON.parse(serializeState(s)) as { entities: { facing?: number; owner: number }[] };
    delete raw.entities[0]!.facing;
    delete raw.entities[1]!.facing;
    const loaded = deserializeState(JSON.stringify(raw));
    expect(loaded.entities[0]?.facing).toBe(0);
    expect(loaded.entities[1]?.facing).toBe(4);
  });

  it("round-trips repairing and backfills it on legacy entities", () => {
    const s = makeFixture({ seed: 11, win: { kind: "annihilate" } });
    const power = addBuilding(s, 0, "power", 2, 2);
    power.hp = 200;
    power.repairing = true;
    const storage = memoryStorage();
    writeSave(storage, s);
    const loaded = readSave(storage, 11);
    expect(loaded?.entities[0]?.repairing).toBe(true);

    const raw = JSON.parse(serializeState(s)) as { entities: { repairing?: boolean }[] };
    delete raw.entities[0]!.repairing;
    const backfilled = deserializeState(JSON.stringify(raw));
    expect(backfilled.entities[0]?.repairing).toBe(false);
  });
});
