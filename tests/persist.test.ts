import { describe, expect, it } from "vitest";
import { listSaves, memoryStorage, readSave, writeSave } from "../lib/persist/save";
import { addBuilding, makeFixture } from "../lib/sim/fixtures";
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
});
