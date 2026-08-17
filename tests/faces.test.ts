import { describe, expect, it } from "vitest";
import { generateCharacters } from "../lib/gen/characters";
import { generateFace } from "../lib/gen/faces";
import {
  PORTRAIT_EYE_CLIPS,
  PORTRAIT_MOUTH_CLIP,
  PORTRAIT_OFFSET_NONE,
  choosePortraitMouthClip,
  detectPortraitMouthClip,
  measurePortraitOffset,
  portraitBlinking,
  portraitClipWindow,
  portraitFrameIndex,
  portraitFrameRect,
  portraitHasDrift,
  portraitSpeechFrame,
  resolvePortraitAnimation,
  scalePortraitOffset,
} from "../lib/render/portraits";
import { createRng } from "../lib/seed/rng";

describe("portrait DNA", () => {
  it("is deterministic for a forked seed", () => {
    const a = generateFace(createRng(421, "cmd-face"));
    const b = generateFace(createRng(421, "cmd-face"));
    expect(a).toEqual(b);
  });

  it("keeps DNA in valid ranges", () => {
    for (const seed of [0, 7, 42, 421, 9999]) {
      const face = generateFace(createRng(seed, "face"));
      expect(face.portraitId).toMatch(/^(commander|advisor|enemy-leader)-\d{2}$/);
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
      expect(face.ageBand).toBeGreaterThanOrEqual(0);
      expect(face.ageBand).toBeLessThanOrEqual(2);
      expect(face.faceShape).toBeGreaterThanOrEqual(0);
      expect(face.faceShape).toBeLessThanOrEqual(3);
      expect(face.complexion).toBeGreaterThanOrEqual(0);
      expect(face.complexion).toBeLessThanOrEqual(2);
      expect(face.hairTexture).toBeGreaterThanOrEqual(0);
      expect(face.hairTexture).toBeLessThanOrEqual(2);
      expect(face.uniformStyle).toBeGreaterThanOrEqual(0);
      expect(face.uniformStyle).toBeLessThanOrEqual(2);
      expect(face.accessory).toBeGreaterThanOrEqual(0);
      expect(face.accessory).toBeLessThanOrEqual(3);
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
    expect(new Set(faces.map((f) => f.ageBand)).size).toBeGreaterThan(1);
    expect(new Set(faces.map((f) => f.faceShape)).size).toBeGreaterThan(2);
    expect(new Set(faces.map((f) => f.uniformStyle)).size).toBeGreaterThan(1);
    expect(new Set(faces.map((f) => f.accessory)).size).toBeGreaterThan(2);
    expect(faces.some((f) => f.feminine) && faces.some((f) => !f.feminine)).toBe(true);
  });

  it("holds speech visemes long enough to read at briefing size", () => {
    const sequence = Array.from({ length: 800 }, (_, time) => portraitSpeechFrame(time, "commander-01", 3));
    let longestOpen = 0;
    let run = 0;
    for (const frame of sequence) {
      if (frame === 2) {
        run += 1;
        longestOpen = Math.max(longestOpen, run);
      } else {
        run = 0;
      }
    }
    expect(longestOpen).toBeGreaterThanOrEqual(15);
  });

  it("alternates bitmap mouth frames while a portrait is speaking", () => {
    const sequence = Array.from({ length: 240 }, (_, time) => portraitSpeechFrame(time, "commander-01", 3));
    expect(new Set(sequence)).toEqual(new Set([0, 2]));
    expect(sequence.some((frame, index) => index > 0 && frame === sequence[index - 1])).toBe(true);
    expect(sequence.some((frame, index) => index > 0 && frame !== sequence[index - 1])).toBe(true);
    expect(portraitSpeechFrame(40, "commander-01", 3)).not.toBe(1);
  });

  it("keeps idle portraits blinking without opening the mouth", () => {
    const frames = Array.from({ length: 400 }, (_, time) => portraitFrameIndex(time, false, 3, "commander-01"));
    expect(frames).toContain(0);
    expect(frames).toContain(1);
    expect(frames).not.toContain(2);
    expect(frames.every((frame, time) => frame === (portraitBlinking(time, "commander-01") ? 1 : 0))).toBe(true);
  });

  it("clips blink and speech onto the idle frame instead of swapping the whole sheet", () => {
    expect(PORTRAIT_MOUTH_CLIP.cx).toBeCloseTo(0.5);
    expect(PORTRAIT_MOUTH_CLIP.cy).toBeGreaterThan(0.55);
    expect(PORTRAIT_MOUTH_CLIP.cy).toBeLessThan(0.75);
    expect(PORTRAIT_EYE_CLIPS).toHaveLength(2);
    for (const clip of [PORTRAIT_MOUTH_CLIP, ...PORTRAIT_EYE_CLIPS]) {
      expect(clip.cx - clip.rx).toBeGreaterThanOrEqual(0);
      expect(clip.cx + clip.rx).toBeLessThanOrEqual(1);
      expect(clip.cy - clip.ry).toBeGreaterThanOrEqual(0);
      expect(clip.cy + clip.ry).toBeLessThanOrEqual(1);
    }
  });

  it("gives portraits independent deterministic blink timing", () => {
    const portraitIds = ["commander-01", "advisor-09", "enemy-leader-07"];
    const samples = portraitIds.flatMap((portraitId) =>
      Array.from({ length: 600 }, (_, time) => portraitBlinking(time, portraitId)),
    );
    expect(new Set(samples)).toEqual(new Set([false, true]));
    expect(portraitBlinking(0, "commander-01")).toBe(portraitBlinking(0, "commander-01"));
    const commanderTimeline = Array.from({ length: 600 }, (_, time) => portraitBlinking(time, portraitIds[0]!));
    expect(
      portraitIds.slice(1).some((portraitId) =>
        commanderTimeline.some((value, time) => portraitBlinking(time, portraitId) !== value),
      ),
    ).toBe(true);
  });

  it("registers a drifted animation frame back onto the idle sheet", () => {
    const width = 48;
    const height = 48;
    const idle = rgbaSquare(width, height, 12, 10, 18, 16);
    const drifted = rgbaSquare(width, height, 12 + 4, 10 - 3, 18, 16);
    expect(measurePortraitOffset(idle, drifted, width, height, 8)).toEqual({ dx: -4, dy: 3 });
    expect(scalePortraitOffset({ dx: -4, dy: 3 }, 80, 200)).toEqual({ dx: -10, dy: 7.5 });
  });

  it("registers a talk viseme using the mouth window, not the whole sheet", () => {
    const width = 64;
    const height = 64;
    const idle = rgbaSquare(width, height, 24, 36, 16, 10);
    const drifted = rgbaSquare(width, height, 24 + 3, 36, 16, 10);
    const window = portraitClipWindow([{ cx: 0.5, cy: 0.635, rx: 0.18, ry: 0.09 }], width, height, 4);
    expect(window.y0).toBeGreaterThan(20);
    expect(measurePortraitOffset(idle, drifted, width, height, 8, window)).toEqual({ dx: -3, dy: 0 });
  });

  it("detects the idle lip line for the mouth clip", () => {
    const width = 80;
    const height = 80;
    const idle = rgbaSquare(width, height, 0, 0, width, height, 170);
    paintRect(idle, width, 28, 50, 24, 3, 18);
    const clip = detectPortraitMouthClip(idle, width, height);
    expect(clip.cy).toBeGreaterThan(0.58);
    expect(clip.cy).toBeLessThan(0.7);
    expect(clip.cx).toBeGreaterThan(0.4);
    expect(clip.cx).toBeLessThan(0.6);
  });

  it("keeps generic mouth clips when detection latches onto a collar", () => {
    expect(
      choosePortraitMouthClip({ cx: 0.5, cy: 0.82, rx: 0.15, ry: 0.075 }),
    ).toEqual(PORTRAIT_MOUTH_CLIP);
    const nearby = choosePortraitMouthClip({ cx: 0.49, cy: 0.66, rx: 0.15, ry: 0.075 });
    expect(nearby.cx).toBeCloseTo(0.49);
    expect(nearby.cy).toBeCloseTo(0.66);
    expect(nearby.rx).toBe(PORTRAIT_MOUTH_CLIP.rx);
  });

  it("does not shift already-aligned portrait sheets", () => {
    const width = 48;
    const height = 48;
    const idle = rgbaSquare(width, height, 12, 10, 18, 16);
    const solved = resolvePortraitAnimation(idle, idle, idle, width, height);
    expect(portraitHasDrift(solved.blink)).toBe(false);
    expect(portraitHasDrift(solved.talk)).toBe(false);
    expect(solved.mouthClip).toEqual(PORTRAIT_MOUTH_CLIP);
    expect(solved.talk).toEqual(PORTRAIT_OFFSET_NONE);
  });

  it("crops each bitmap using its actual native sheet width", () => {
    expect(portraitFrameRect(1821, 864, 3, 2)).toEqual({ sx: 1214, sy: 0, sw: 607, sh: 864 });
    expect(portraitFrameRect(1536, 1024, 3, 2, 200, 240)).toEqual({
      sx: 1024,
      sy: 40.96,
      sw: 512,
      sh: 614.4,
    });
  });
});

function rgbaSquare(
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 220,
  background = 12,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const on = px >= x && px < x + w && py >= y && py < y + h;
      const index = (py * width + px) * 4;
      const value = on ? fill : background;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return data;
}

function paintRect(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
): void {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const index = (py * width + px) * 4;
      data[index] = fill;
      data[index + 1] = fill;
      data[index + 2] = fill;
    }
  }
}
