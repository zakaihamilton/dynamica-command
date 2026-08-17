import { describe, expect, it } from "vitest";
import { generateCharacters } from "../lib/gen/characters";
import { generateFace } from "../lib/gen/faces";
import { createRng } from "../lib/seed/rng";

describe("procedural faces", () => {
  it("is deterministic for a forked seed", () => {
    const a = generateFace(createRng(421, "cmd-face"));
    const b = generateFace(createRng(421, "cmd-face"));
    expect(a).toEqual(b);
  });

  it("keeps DNA in valid ranges", () => {
    for (const seed of [0, 7, 42, 421, 9999]) {
      const face = generateFace(createRng(seed, "face"));
      expect(face.skin).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.hair).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.eyes).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.uniform).toMatch(/^#[0-9a-f]{6}$/i);
      expect(face.hairStyle).toBeGreaterThanOrEqual(0);
      expect(face.hairStyle).toBeLessThanOrEqual(3);
      expect(face.headgear).toBeGreaterThanOrEqual(0);
      expect(face.headgear).toBeLessThanOrEqual(3);
      expect(face.beard).toBeGreaterThanOrEqual(0);
      expect(face.beard).toBeLessThanOrEqual(3);
      expect(face.jaw).toBeGreaterThanOrEqual(0.8);
      expect(face.jaw).toBeLessThanOrEqual(1.2);
      expect(face.nose).toBeGreaterThanOrEqual(0.4);
      expect(face.mouthWidth).toBeGreaterThan(0.3);
      expect(typeof face.scar).toBe("boolean");
    }
  });

  it("gives campaign officers distinct portraits", () => {
    const a = generateCharacters(421);
    const b = generateCharacters(421);
    expect(a).toEqual(b);
    expect(a.commander.face).not.toEqual(a.advisor.face);
    expect(a.commander.face).not.toEqual(a.enemyLeader.face);
    expect(a.advisor.face.headgear).not.toBe(a.enemyLeader.face.headgear);
  });
});
