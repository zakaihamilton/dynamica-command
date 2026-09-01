import { sceneryAt, type ScenerySample } from "../gen/map";
import type { SimState } from "../types";

function sceneryKey(x: number, y: number): number {
  return ((x + 512) << 12) | (y + 512);
}

/**
 * Shares terrain lookup results for one simulation tick. The memo resets at
 * the same tick boundary used by terrain updates, so paint and overlays avoid
 * repeated map sampling without retaining stale state between frames.
 */
export class SceneryMemo {
  private state: SimState | null = null;
  private tick = -1;
  private readonly samples = new Map<number, ScenerySample>();

  clear(): void {
    this.state = null;
    this.tick = -1;
    this.samples.clear();
  }

  sample(state: SimState, x: number, y: number): ScenerySample {
    if (this.state !== state || this.tick !== state.tick) {
      this.state = state;
      this.tick = state.tick;
      this.samples.clear();
    }
    const key = sceneryKey(x, y);
    let sample = this.samples.get(key);
    if (!sample) {
      sample = sceneryAt(state, x, y);
      this.samples.set(key, sample);
    }
    return sample;
  }
}
