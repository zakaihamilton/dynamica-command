// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_SAMPLE_RATE } from "../lib/audio/constants";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

class FakeParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  setTargetAtTime(value: number): void {
    this.value = value;
  }
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  readonly inputs: FakeNode[] = [];
  readonly gain = new FakeParam();
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();

  connect(dest: FakeNode): FakeNode {
    this.connections.push(dest);
    dest.inputs.push(this);
    return dest;
  }

  disconnect(): void {
    for (const dest of this.connections) {
      const index = dest.inputs.indexOf(this);
      if (index >= 0) dest.inputs.splice(index, 1);
    }
    this.connections.length = 0;
  }
}

class FakeAudioContext {
  sampleRate = AUDIO_SAMPLE_RATE;
  currentTime = 0;
  destination = new FakeNode();
  failCompressor = false;

  createGain(): FakeNode {
    return new FakeNode();
  }

  createDynamicsCompressor(): FakeNode {
    if (this.failCompressor) throw new Error("compressor unavailable");
    return new FakeNode();
  }
}

async function loadMixer(audio: FakeAudioContext) {
  vi.stubGlobal("window", {
    AudioContext: class {
      constructor() {
        return audio;
      }
    },
  });
  const context = await import("../lib/audio/context");
  const mixer = await import("../lib/audio/mixer");
  context.getAudioContext();
  return mixer;
}

describe("sfx mixer graph", () => {
  it("wires sfx through a limiter and makeup gain without duplicating the destination", async () => {
    const audio = new FakeAudioContext();
    const { getAudioBus, SFX_MAKEUP_GAIN, resetAudioMixerForTests } = await loadMixer(audio);

    const sfx = getAudioBus("sfx") as unknown as FakeNode;
    getAudioBus("sfx");
    getAudioBus("music");

    expect(audio.destination.inputs).toHaveLength(1);
    const master = audio.destination.inputs[0]!;
    expect(sfx.connections).toHaveLength(1);
    const limiter = sfx.connections[0]!;
    expect(limiter.connections).toHaveLength(1);
    const makeup = limiter.connections[0]!;
    expect(makeup.gain.value).toBe(SFX_MAKEUP_GAIN);
    expect(makeup.connections).toEqual([master]);
    expect(limiter.attack.value).toBe(0);
    expect(limiter.ratio.value).toBe(12);

    resetAudioMixerForTests();
    expect(audio.destination.inputs).toHaveLength(0);
  });

  it("does not leave a destination graph if limiter creation fails", async () => {
    const audio = new FakeAudioContext();
    audio.failCompressor = true;
    const { getAudioBus } = await loadMixer(audio);

    expect(() => getAudioBus("sfx")).toThrow(/compressor unavailable/);
    expect(audio.destination.inputs).toHaveLength(0);

    audio.failCompressor = false;
    const sfx = getAudioBus("sfx");
    expect(sfx).toBeTruthy();
    expect(audio.destination.inputs).toHaveLength(1);
  });
});
