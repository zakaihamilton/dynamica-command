import { describe, expect, it } from "vitest";
import { TILE_H, createCamera, tileToScreen } from "../lib/render/iso";
import { pickEntity } from "../lib/render/pick";
import { issue, tick } from "../lib/sim/api";
import { addBuilding, addUnit, makeFixture, setTile, TILE_RESOURCE } from "../lib/sim/fixtures";
import { heightAt } from "../lib/sim/world";

describe("harvester selection", () => {
  it("selects a harvester from a click on its sprite body", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    const h = addUnit(s, 0, "harvester", 5, 5);
    const cam = createCamera();
    const pos = tileToScreen(h.x, h.y, cam, heightAt(s, 5, 5));
    const onBody = pickEntity(s, pos.x, pos.y - 12, cam);
    expect(onBody?.id).toBe(h.id);
    expect(onBody?.kind).toBe("harvester");
  });

  it("prefers a harvester overlapping a neighboring refinery over the building", () => {
    const s = makeFixture({ width: 14, height: 12, win: { kind: "annihilate" } });
    const refinery = addBuilding(s, 0, "refinery", 4, 4);
    const h = addUnit(s, 0, "harvester", 4, 6);
    const cam = createCamera();
    const pos = tileToScreen(h.x, h.y, cam, heightAt(s, Math.round(h.x), Math.round(h.y)));
    const hit = pickEntity(s, pos.x, pos.y - 16, cam);
    expect(hit?.id).toBe(h.id);
    expect(hit?.id).not.toBe(refinery.id);
  });

  it("still auto-harvests after the harvester is treated as selected", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "refinery", 2, 2);
    setTile(s, 7, 5, TILE_RESOURCE, 400);
    const h = addUnit(s, 0, "harvester", 7, 5);
    const selected = new Set([h.id]);
    expect(selected.has(h.id)).toBe(true);
    for (let i = 0; i < 8; i++) tick(s);
    expect(h.carry).toBeGreaterThan(0);
    expect(s.result).toBe("playing");
  });

  it("accepts move orders for a selected harvester", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const h = addUnit(s, 0, "harvester", 2, 2);
    issue(s, { type: "move", unitIds: [h.id], x: 6, y: 2 });
    for (let i = 0; i < 400; i++) tick(s);
    expect(Math.round(h.x)).toBe(6);
    expect(Math.round(h.y)).toBe(2);
  });

  it("keeps tile-diamond clicks working for infantry", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    const u = addUnit(s, 0, "infantry", 5, 5);
    const cam = createCamera();
    const pos = tileToScreen(u.x, u.y, cam, heightAt(s, 5, 5));
    const hit = pickEntity(s, pos.x, pos.y + TILE_H / 4, cam);
    expect(hit?.id).toBe(u.id);
  });
});
