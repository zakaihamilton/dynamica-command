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
      expect(face.hairStyle).toBeLessThanOrEqual(5);
      expect(face.headgear).toBeGreaterThanOrEqual(0);
      expect(face.headgear).toBeLessThanOrEqual(4);
      expect(face.beard).toBeGreaterThanOrEqual(0);
      expect(face.beard).toBeLessThanOrEqual(3);
      expect(face.scar).toBeGreaterThanOrEqual(0);
      expect(face.scar).toBeLessThanOrEqual(3);
      expect(face.eyeShape).toBeGreaterThanOrEqual(0);
      expect(face.eyeShape).toBeLessThanOrEqual(2);
      expect(face.noseStyle).toBeGreaterThanOrEqual(0);
      expect(face.noseStyle).toBeLessThanOrEqual(2);
      expect(face.mouthStyle).toBeGreaterThanOrEqual(0);
      expect(face.mouthStyle).toBeLessThanOrEqual(2);
      expect(face.jaw).toBeGreaterThanOrEqual(0.75);
      expect(face.jaw).toBeLessThanOrEqual(1.25);
      expect(face.nose).toBeGreaterThanOrEqual(0.3);
      expect(face.mouthWidth).toBeGreaterThan(0.3);
      expect(face.eyeSize).toBeGreaterThan(0.7);
      expect(typeof face.glasses).toBe("boolean");
      expect(typeof face.headset).toBe("boolean");
      expect(typeof face.feminine).toBe("boolean");
    }
  });

  it("gives campaign officers distinct portraits", () => {
    const a = generateCharacters(421);
    const b = generateCharacters(421);
    expect(a).toEqual(b);
    expect(a.commander.face).not.toEqual(a.advisor.face);
    expect(a.commander.face).not.toEqual(a.enemyLeader.face);
  });

  it("varies eyes, noses, and mouths across a campaign", () => {
    const faces = [0, 42, 421, 2346, 9999].flatMap((seed) => {
      const c = generateCharacters(seed);
      return [c.commander.face, c.advisor.face, c.enemyLeader.face];
    });
    expect(new Set(faces.map((f) => f.eyeShape)).size).toBeGreaterThan(1);
    expect(new Set(faces.map((f) => f.noseStyle)).size).toBeGreaterThan(1);
    expect(new Set(faces.map((f) => f.mouthStyle)).size).toBeGreaterThan(1);
    expect(new Set(faces.map((f) => f.hairStyle)).size).toBeGreaterThan(1);
    expect(faces.some((f) => f.feminine) && faces.some((f) => !f.feminine)).toBe(true);
  });
});
