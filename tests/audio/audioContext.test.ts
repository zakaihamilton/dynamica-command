// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_SAMPLE_RATE } from "../../lib/audio/constants";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("audio context", () => {
  it("creates the live graph at the export sample rate", async () => {
    const optionsSeen: AudioContextOptions[] = [];
    class AudioContextStub {
      sampleRate = AUDIO_SAMPLE_RATE;

      constructor(options?: AudioContextOptions) {
        if (options) optionsSeen.push(options);
      }
    }

    vi.stubGlobal("window", { AudioContext: AudioContextStub });
    const { getAudioContext } = await import("../../lib/audio/context");

    expect(getAudioContext()?.sampleRate).toBe(AUDIO_SAMPLE_RATE);
    expect(optionsSeen).toEqual([{ sampleRate: AUDIO_SAMPLE_RATE }]);
  });
});
