import { tick } from "../sim/api";
import type { Command, SimEvent, SimState } from "../types";

export const TICK_MS = 1000 / 12;

export type LoopHandle = {
  stop: () => void;
};

export type LoopOptions = {
  getState: () => SimState;
  setState: (s: SimState) => void;
  drainCommands: () => Command[];
  isPaused?: () => boolean;
  onFrame?: (now: number, state: SimState, paused: boolean) => void;
  onTick?: (state: SimState, events: SimEvent[], now: number) => void;
  onEvents?: (events: SimEvent[]) => void;
};

export function startLoop({
  getState,
  setState,
  drainCommands,
  isPaused,
  onFrame,
  onTick,
  onEvents,
}: LoopOptions): LoopHandle {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  const frame = (now: number) => {
    if (stopped) return;
    const paused = isPaused?.() ?? false;
    let state = getState();
    if (paused) {
      acc = 0;
      last = now;
      onFrame?.(now, state, true);
      raf = requestAnimationFrame(frame);
      return;
    }
    acc += now - last;
    last = now;
    while (acc >= TICK_MS && state.result === "playing") {
      const cmds = drainCommands();
      const out = tick(state, cmds.length ? cmds : undefined);
      state = out.state;
      setState(state);
      onTick?.(state, out.events, now);
      onEvents?.(out.events);
      acc -= TICK_MS;
    }
    if (state.result !== "playing") acc = 0;
    onFrame?.(now, state, false);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}
