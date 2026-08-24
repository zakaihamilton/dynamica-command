import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { formatSeed } from "../seed/rng";
import { MusicExportCancelledError, renderMissionMusic } from "./music";

export { MusicExportCancelledError } from "./music";

export const MUSIC_EXPORT_SAMPLE_RATE = 44_100;
export const MUSIC_EXPORT_BITRATE = 160_000;
export const MUSIC_EXPORT_CODEC = "mp4a.40.2";

export type MusicExportPhase = "checking" | "rendering" | "encoding" | "complete";

export type MusicExportProgress = {
  phase: MusicExportPhase;
  progress: number;
  phaseProgress: number;
};

export type MusicExportResult = {
  blob: Blob;
  filename: string;
};

type EncoderConstructor = typeof AudioEncoder;
type AudioDataConstructor = typeof AudioData;

function throwIfExportAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MusicExportCancelledError();
}

function getEncoder(): EncoderConstructor | null {
  if (typeof window === "undefined" || typeof window.AudioEncoder === "undefined") return null;
  return window.AudioEncoder;
}

function getAudioData(): AudioDataConstructor | null {
  if (typeof window === "undefined" || typeof window.AudioData === "undefined") return null;
  return window.AudioData;
}

export async function supportsM4aExport(): Promise<boolean> {
  const Encoder = getEncoder();
  const AudioDataClass = getAudioData();
  const Offline = typeof window === "undefined" ? undefined : window.OfflineAudioContext;
  if (!Encoder || !AudioDataClass || !Offline) return false;
  try {
    const support = await Encoder.isConfigSupported({
      codec: MUSIC_EXPORT_CODEC,
      sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: MUSIC_EXPORT_BITRATE,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

export function missionSoundtrackFilename(seed: number, missionIndex: number): string {
  return `genesis-protocol-${formatSeed(seed)}-mission-${String(missionIndex + 1).padStart(2, "0")}.m4a`;
}

function interleaveAudioBuffer(buffer: AudioBuffer, start: number, count: number): Float32Array<ArrayBuffer> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const output = new Float32Array(new ArrayBuffer(count * 2 * Float32Array.BYTES_PER_ELEMENT));
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(Math.min(1, channels - 1));
  for (let frame = 0; frame < count; frame++) {
    output[frame * 2] = left[start + frame] ?? 0;
    output[frame * 2 + 1] = right[start + frame] ?? output[frame * 2];
  }
  return output;
}

async function encodeM4a(
  buffer: AudioBuffer,
  onProgress?: (progress: MusicExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const Encoder = getEncoder();
  const AudioDataClass = getAudioData();
  if (!Encoder || !AudioDataClass) throw new Error("AAC audio export is not supported in this browser.");
  throwIfExportAborted(signal);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    audio: {
      codec: "aac",
      numberOfChannels: 2,
      sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
    },
    fastStart: "in-memory",
  });
  const encodedChunks: Array<{ chunk: EncodedAudioChunk; metadata?: EncodedAudioChunkMetadata }> = [];
  let encodeError: Error | null = null;
  let encoder: InstanceType<EncoderConstructor> | null = null;
  try {
    encoder = new Encoder({
      output: (chunk, metadata) => encodedChunks.push({ chunk, metadata }),
      error: (error) => {
        encodeError = error instanceof Error ? error : new Error(String(error));
      },
    });
    encoder.configure({
      codec: MUSIC_EXPORT_CODEC,
      sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: MUSIC_EXPORT_BITRATE,
    });

    const framesPerChunk = 1024;
    const totalFrames = buffer.length;
    for (let start = 0; start < totalFrames; start += framesPerChunk) {
      throwIfExportAborted(signal);
      if (encodeError) throw encodeError;
      const frameCount = Math.min(framesPerChunk, totalFrames - start);
      const data = interleaveAudioBuffer(buffer, start, frameCount);
      const audioData = new AudioDataClass({
        format: "f32",
        numberOfChannels: 2,
        numberOfFrames: frameCount,
        sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
        timestamp: Math.round((start / MUSIC_EXPORT_SAMPLE_RATE) * 1_000_000),
        data,
      });
      try {
        encoder.encode(audioData);
      } finally {
        audioData.close();
      }
      const phaseProgress = Math.min(0.99, (start + frameCount) / totalFrames);
      onProgress?.({ phase: "encoding", progress: phaseProgress, phaseProgress });
      if (encoder.encodeQueueSize > 8) {
        await encoder.flush();
        throwIfExportAborted(signal);
      }
    }
    await encoder.flush();
    throwIfExportAborted(signal);
    if (encodeError) throw encodeError;
    encodedChunks.sort((left, right) => (left.chunk.timestamp ?? 0) - (right.chunk.timestamp ?? 0));
    for (const { chunk, metadata } of encodedChunks) muxer.addAudioChunk(chunk, metadata);
    muxer.finalize();
    if (!target.buffer) throw new Error("The AAC encoder produced no audio data.");
    return new Blob([target.buffer], { type: "audio/mp4" });
  } finally {
    if (encoder && encoder.state !== "closed") {
      try {
        encoder.close();
      } catch {
        /* The encoder may already be closed after a fatal encode error. */
      }
    }
    encodedChunks.length = 0;
  }
}

export async function exportMissionSoundtrack(
  seed: number,
  missionIndex: number,
  onProgress?: (progress: MusicExportProgress) => void,
  options: { signal?: AbortSignal } = {},
): Promise<MusicExportResult> {
  throwIfExportAborted(options.signal);
  onProgress?.({ phase: "checking", progress: 0, phaseProgress: 0 });
  if (!(await supportsM4aExport())) throw new Error("M4A export is unavailable in this browser. Try a browser with native AAC WebCodecs support.");
  throwIfExportAborted(options.signal);
  onProgress?.({ phase: "rendering", progress: 0.08, phaseProgress: 0 });
  const rendered = await renderMissionMusic(seed, missionIndex, MUSIC_EXPORT_SAMPLE_RATE, {
    signal: options.signal,
    onProgress: (phaseProgress) => onProgress?.({
      phase: "rendering",
      progress: 0.08 + phaseProgress * 0.47,
      phaseProgress,
    }),
  });
  throwIfExportAborted(options.signal);
  onProgress?.({ phase: "encoding", progress: 0.55, phaseProgress: 0 });
  const blob = await encodeM4a(rendered, (nextProgress) => onProgress?.({
    phase: "encoding",
    progress: 0.55 + nextProgress.phaseProgress * 0.44,
    phaseProgress: nextProgress.phaseProgress,
  }), options.signal);
  throwIfExportAborted(options.signal);
  onProgress?.({ phase: "complete", progress: 1, phaseProgress: 1 });
  return { blob, filename: missionSoundtrackFilename(seed, missionIndex) };
}

export function downloadMusicExport(result: MusicExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
