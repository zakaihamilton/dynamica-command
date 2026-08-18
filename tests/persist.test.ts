import { describe, expect, it, vi } from "vitest";
import { deserializeState, listSaves, memoryStorage, readSave, removeSave, saveKey, SAVE_VERSION, serializeState, writeSave } from "../lib/persist/save";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { tick } from "../lib/sim/api";

describe("persist", () => {
  it("round-trips a save through memory storage", () => {
    const s = makeFixture({ seed: 421, win: { kind: "harvestQuota", target: 9000 } });
    addBuilding(s, 0, "constructionYard", 1, 1);
    tick(s);
    tick(s);
    s.losses.units = [1, 2];
    s.losses.buildings = [3, 4];
    const storage = memoryStorage();
    writeSave(storage, s);
    const loaded = readSave(storage, 421);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(s.tick);
    expect(loaded!.credits[0]).toBe(s.credits[0]);
    expect(loaded!.losses).toEqual({ units: [1, 2], buildings: [3, 4] });
    expect(loaded!.win.kind).toBe("harvestQuota");
    const listed = listSaves(storage);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.seed).toBe("0421");
    expect(listed[0]!.campaignName).toBeTruthy();
  });

  it("writes a versioned envelope and rejects malformed or mismatched saves", () => {
    const storage = memoryStorage();
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    writeSave(storage, state);

    const envelope = JSON.parse(storage.getItem(saveKey(421))!);
    expect(envelope.version).toBe(SAVE_VERSION);
    expect(envelope.state.seed).toBe(421);
    expect(readSave(storage, 421)?.seed).toBe(421);

    storage.setItem(saveKey(421), JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 1, state }));
    expect(readSave(storage, 421)).toBeNull();

    storage.setItem(saveKey(421), JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: { ...state, seed: 9 } }));
    expect(readSave(storage, 421)).toBeNull();
    expect(() => deserializeState(JSON.stringify({ nope: true }))).toThrow("Invalid save state");
  });

  it("lists campaigns by last saved time", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const storage = memoryStorage();
      writeSave(storage, makeFixture({ seed: 9, win: { kind: "annihilate" } }));
      vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));
      writeSave(storage, makeFixture({ seed: 1, win: { kind: "annihilate" } }));
      expect(listSaves(storage).map((s) => s.seed)).toEqual(["0001", "0009"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes only the requested campaign save", () => {
    const storage = memoryStorage();
    writeSave(storage, makeFixture({ seed: 9, win: { kind: "annihilate" } }));
    writeSave(storage, makeFixture({ seed: 10, win: { kind: "annihilate" } }));

    removeSave(storage, 9);

    expect(readSave(storage, 9)).toBeNull();
    expect(readSave(storage, 10)).not.toBeNull();
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

  it("backfills zeroed loss counters in legacy saves", () => {
    const legacy = JSON.parse(serializeState(makeFixture({ seed: 77, win: { kind: "annihilate" } }))) as { losses?: unknown };
    delete legacy.losses;
    const loaded = deserializeState(JSON.stringify(legacy));
    expect(loaded.losses).toEqual({ units: [0, 0], buildings: [0, 0] });
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
