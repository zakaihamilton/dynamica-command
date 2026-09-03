// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const renderMissionMusic = vi.fn();
const addAudioChunk = vi.fn();

vi.mock("../../lib/audio/music", () => ({
  MusicExportCancelledError: class MusicExportCancelledError extends Error {
    name = "AbortError";
    constructor() {
      super("Mission soundtrack export was cancelled.");
    }
  },
  renderMissionMusic,
}));

vi.mock("mp4-muxer", () => ({
  ArrayBufferTarget: class ArrayBufferTarget {
    buffer = new ArrayBuffer(8);
  },
  Muxer: class Muxer {
    addAudioChunk = addAudioChunk;
    finalize() {}
  },
}));

class MockAudioEncoder {
  static flushCount = 0;
  static encodeCount = 0;
  encodeQueueSize = 0;
  state = "unconfigured";
  protected readonly output: EncodedAudioChunkOutputCallback;
  protected readonly dequeueListeners = new Set<EventListener>();

  static isConfigSupported = async () => ({ supported: true });

  static resetCounts() {
    MockAudioEncoder.flushCount = 0;
    MockAudioEncoder.encodeCount = 0;
  }

  constructor(init: AudioEncoderInit) {
    this.output = init.output;
  }

  configure() {
    this.state = "configured";
  }

  encode() {
    MockAudioEncoder.encodeCount += 1;
    this.encodeQueueSize += 1;
    this.output({ timestamp: MockAudioEncoder.encodeCount } as EncodedAudioChunk, {});
    queueMicrotask(() => {
      this.encodeQueueSize = Math.max(0, this.encodeQueueSize - 1);
      for (const listener of this.dequeueListeners) listener(new Event("dequeue"));
    });
  }

  async flush() {
    MockAudioEncoder.flushCount += 1;
    this.encodeQueueSize = 0;
  }

  close() {
    this.state = "closed";
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === "dequeue") this.dequeueListeners.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.dequeueListeners.delete(listener);
  }
}

class MockAudioData {
  close() {}
}

function fakeBuffer(frames: number): AudioBuffer {
  const data = new Float32Array(frames);
  return {
    length: frames,
    numberOfChannels: 2,
    sampleRate: 44_100,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

async function importExport() {
  return import("../../lib/audio/export");
}

afterEach(() => {
  MockAudioEncoder.resetCounts();
  addAudioChunk.mockClear();
  renderMissionMusic.mockReset();
  delete (window as Window & { AudioEncoder?: unknown }).AudioEncoder;
  delete (window as Window & { AudioData?: unknown }).AudioData;
  delete (window as Window & { OfflineAudioContext?: unknown }).OfflineAudioContext;
  vi.resetModules();
});

describe("soundtrack AAC encoding", () => {
  it("flushes the encoder only after the last PCM chunk", async () => {
    Object.assign(window, {
      AudioEncoder: MockAudioEncoder,
      AudioData: MockAudioData,
      OfflineAudioContext: class OfflineAudioContextStub {},
    });
    renderMissionMusic.mockResolvedValue(fakeBuffer(1024 * 24));
    const { exportMissionSoundtrack } = await importExport();

    await exportMissionSoundtrack(421, 0);

    expect(renderMissionMusic).toHaveBeenCalledTimes(8);
    expect(MockAudioEncoder.encodeCount).toBe(1 + 108);
    expect(MockAudioEncoder.flushCount).toBe(2);
    expect(addAudioChunk).toHaveBeenCalledTimes(108);
  });

  it("does not flush to relieve encoder backpressure", async () => {
    class BackpressuredEncoder extends MockAudioEncoder {
      encode() {
        MockAudioEncoder.encodeCount += 1;
        this.encodeQueueSize = 12;
        this.output({ timestamp: MockAudioEncoder.encodeCount } as EncodedAudioChunk, {});
        queueMicrotask(() => {
          this.encodeQueueSize = 0;
          for (const listener of this.dequeueListeners) listener(new Event("dequeue"));
        });
      }
    }

    Object.assign(window, {
      AudioEncoder: BackpressuredEncoder,
      AudioData: MockAudioData,
      OfflineAudioContext: class OfflineAudioContextStub {},
    });
    renderMissionMusic.mockResolvedValue(fakeBuffer(1024 * 12));
    const { exportMissionSoundtrack } = await importExport();

    await exportMissionSoundtrack(421, 0);

    expect(MockAudioEncoder.encodeCount).toBe(1 + 54);
    expect(MockAudioEncoder.flushCount).toBe(2);
  });
});
