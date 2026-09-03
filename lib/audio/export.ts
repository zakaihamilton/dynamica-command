import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { formatSeed } from "../seed/rng";
import { MUSIC_BARS } from "./compose";
import { AUDIO_SAMPLE_RATE } from "./constants";
import { MusicExportCancelledError, renderMissionMusic } from "./music";

export { MusicExportCancelledError } from "./music";

export const MUSIC_EXPORT_SAMPLE_RATE = AUDIO_SAMPLE_RATE;
// Render the synth graph at half the encoder rate; the resample below is
// delegated to the browser's native audio engine rather than JavaScript.
const MUSIC_RENDER_SAMPLE_RATE = 22_050;
export const MUSIC_EXPORT_BITRATE = 160_000;
export const MUSIC_EXPORT_CODEC = "mp4a.40.2";
const ENCODER_QUEUE_LIMIT = 8;
const ENCODE_YIELD_EVERY_CHUNKS = 32;
const MUSIC_EXPORT_CHUNK_BARS = 16;
const MUSIC_EXPORT_CROSSFADE_SECONDS = 0.5;

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

function waitForTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Wait until the encoder has capacity without flushing — flush finalizes AAC windows. */
async function waitForEncoderCapacity(
  encoder: InstanceType<EncoderConstructor>,
  signal?: AbortSignal,
): Promise<void> {
  while (encoder.encodeQueueSize > ENCODER_QUEUE_LIMIT) {
    throwIfExportAborted(signal);
    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        encoder.removeEventListener("dequeue", settle);
        window.clearTimeout(timer);
        resolve();
      };
      encoder.addEventListener("dequeue", settle);
      const timer = window.setTimeout(settle, 16);
    });
  }
  throwIfExportAborted(signal);
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
    const config = {
      codec: MUSIC_EXPORT_CODEC,
      sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: MUSIC_EXPORT_BITRATE,
    } as const;
    const support = await Encoder.isConfigSupported(config);
    if (support.supported !== true) return false;

    // isConfigSupported() only validates the configuration. Probe one AAC
    // frame as well, so the UI does not advertise an export path that fails
    // when the encoder is actually opened.
    let encoder: InstanceType<EncoderConstructor> | null = null;
    let audioData: InstanceType<AudioDataConstructor> | null = null;
    try {
      encoder = new Encoder({ output: () => undefined, error: () => undefined });
      encoder.configure(config);
      audioData = new AudioDataClass({
        format: "f32",
        numberOfChannels: 2,
        numberOfFrames: 1024,
        sampleRate: MUSIC_EXPORT_SAMPLE_RATE,
        timestamp: 0,
        data: new Float32Array(new ArrayBuffer(2 * 1024 * Float32Array.BYTES_PER_ELEMENT)),
      });
      encoder.encode(audioData);
      audioData.close();
      audioData = null;
      await encoder.flush();
      return true;
    } catch {
      return false;
    } finally {
      audioData?.close();
      if (encoder && encoder.state !== "closed") {
        try {
          encoder.close();
        } catch {
          /* Ignore cleanup errors from a failed capability probe. */
        }
      }
    }
  } catch {
    return false;
  }
}

export function missionSoundtrackFilename(seed: number, missionIndex: number): string {
  return `dynamica-command-${formatSeed(seed)}-mission-${String(missionIndex + 1).padStart(2, "0")}.m4a`;
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

/**
 * Join independently rendered windows while carrying a short effect tail
 * across each boundary. The overlap keeps fresh offline graphs from making
 * audible clicks when the export is kept within a bounded render size.
 */
function mergeAudioBuffers(buffers: readonly AudioBuffer[], requestedOverlap: number): AudioBuffer {
  if (buffers.length === 0) throw new Error("No audio was rendered.");
  if (buffers.length === 1) return buffers[0]!;
  const sampleRate = buffers[0]!.sampleRate;
  const overlap = Math.min(
    Math.max(0, Math.floor(requestedOverlap)),
    ...buffers.map((buffer) => Math.floor(buffer.length / 2)),
  );
  const totalFrames = buffers.reduce((sum, buffer) => sum + buffer.length, 0) - overlap * (buffers.length - 1);
  const outputChannels = [
    new Float32Array(totalFrames),
    new Float32Array(totalFrames),
  ];
  const sourceChannel = (buffer: AudioBuffer, channel: number): Float32Array =>
    buffer.getChannelData(Math.min(channel, Math.max(0, buffer.numberOfChannels - 1)));
  const copy = (buffer: AudioBuffer, sourceStart: number, sourceEnd: number, outputStart: number) => {
    for (let channel = 0; channel < outputChannels.length; channel++) {
      outputChannels[channel]!.set(sourceChannel(buffer, channel).subarray(sourceStart, sourceEnd), outputStart);
    }
  };

  let outputFrame = 0;
  const first = buffers[0]!;
  const firstMainEnd = first.length - overlap;
  copy(first, 0, firstMainEnd, outputFrame);
  outputFrame += firstMainEnd;

  for (let index = 1; index < buffers.length; index++) {
    const previous = buffers[index - 1]!;
    const current = buffers[index]!;
    for (let frame = 0; frame < overlap; frame++) {
      const fadeIn = (frame + 1) / (overlap + 1);
      const fadeOut = 1 - fadeIn;
      for (let channel = 0; channel < outputChannels.length; channel++) {
        const previousData = sourceChannel(previous, channel);
        const currentData = sourceChannel(current, channel);
        outputChannels[channel]![outputFrame + frame] =
          previousData[previous.length - overlap + frame]! * fadeOut + currentData[frame]! * fadeIn;
      }
    }
    outputFrame += overlap;
    const currentMainEnd = index === buffers.length - 1 ? current.length : current.length - overlap;
    copy(current, overlap, currentMainEnd, outputFrame);
    outputFrame += currentMainEnd - overlap;
  }

  return {
    length: totalFrames,
    numberOfChannels: outputChannels.length,
    sampleRate,
    getChannelData(channel: number) {
      return outputChannels[Math.min(channel, outputChannels.length - 1)]!;
    },
  } as unknown as AudioBuffer;
}

async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    onProgress?.(1);
    return buffer;
  }
  if (typeof window === "undefined" || typeof window.OfflineAudioContext === "undefined") {
    throw new Error("Audio resampling is not supported in this browser.");
  }
  throwIfExportAborted(signal);
  const targetLength = Math.ceil(buffer.length * targetSampleRate / buffer.sampleRate);
  const offline = new window.OfflineAudioContext(2, targetLength, targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  onProgress?.(0);
  const rendered = await offline.startRendering();
  throwIfExportAborted(signal);
  onProgress?.(1);
  return rendered;
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
  let encodeError: Error | null = null;
  let encoder: InstanceType<EncoderConstructor> | null = null;
  try {
    encoder = new Encoder({
      output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
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
    let chunksSinceYield = 0;
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
        timestamp: Math.round((start * 1_000_000) / MUSIC_EXPORT_SAMPLE_RATE),
        data,
      });
      try {
        encoder.encode(audioData);
      } finally {
        audioData.close();
      }
      const phaseProgress = Math.min(0.99, (start + frameCount) / totalFrames);
      onProgress?.({ phase: "encoding", progress: phaseProgress, phaseProgress });
      chunksSinceYield += 1;
      if (encoder.encodeQueueSize > ENCODER_QUEUE_LIMIT) {
        await waitForEncoderCapacity(encoder, signal);
        chunksSinceYield = 0;
      } else if (chunksSinceYield >= ENCODE_YIELD_EVERY_CHUNKS) {
        await waitForTimeout(0);
        throwIfExportAborted(signal);
        chunksSinceYield = 0;
      }
    }
    await encoder.flush();
    throwIfExportAborted(signal);
    if (encodeError) throw encodeError;
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
  const normalized: AudioBuffer[] = [];
  for (let barStart = 0; barStart < MUSIC_BARS; barStart += MUSIC_EXPORT_CHUNK_BARS) {
    const barCount = Math.min(MUSIC_EXPORT_CHUNK_BARS, MUSIC_BARS - barStart);
    const isFinalChunk = barStart + barCount === MUSIC_BARS;
    const rendered = await renderMissionMusic(seed, missionIndex, MUSIC_RENDER_SAMPLE_RATE, {
      barStart,
      barCount,
      tailSeconds: isFinalChunk ? 2.2 : MUSIC_EXPORT_CROSSFADE_SECONDS,
      signal: options.signal,
      onProgress: (phaseProgress) => {
        const overall = (barStart + phaseProgress * barCount) / MUSIC_BARS;
        onProgress?.({
          phase: "rendering",
          progress: 0.08 + overall * 0.4,
          phaseProgress: overall * 0.8,
        });
      },
    });
    throwIfExportAborted(options.signal);
    const normalizedChunk = await resampleAudioBuffer(rendered, MUSIC_EXPORT_SAMPLE_RATE, options.signal, (phaseProgress) => {
      const overall = (barStart + phaseProgress * barCount) / MUSIC_BARS;
      onProgress?.({
        phase: "rendering",
        progress: 0.48 + overall * 0.07,
        phaseProgress: 0.8 + overall * 0.2,
      });
    });
    normalized.push(normalizedChunk);
    throwIfExportAborted(options.signal);
  }
  const merged = mergeAudioBuffers(normalized, MUSIC_EXPORT_CROSSFADE_SECONDS * MUSIC_EXPORT_SAMPLE_RATE);
  throwIfExportAborted(options.signal);
  onProgress?.({ phase: "encoding", progress: 0.55, phaseProgress: 0 });
  const blob = await encodeM4a(merged, (nextProgress) => onProgress?.({
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
