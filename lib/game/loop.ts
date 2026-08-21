import { tick } from "../sim/api";
import type { Command, SimEvent, SimState } from "../types";

export const TICK_MS = 1000 / 12;
export const MAX_TICKS_PER_FRAME = 3;
/** A temporary catch-up burst lets the sim recover from a short rendering hitch. */
export const MAX_CATCH_UP_TICKS_PER_FRAME = 12;

export function frameTickBudget(
  acc: number,
  tickMs = TICK_MS,
  maxTicks = MAX_TICKS_PER_FRAME,
): { ticks: number; acc: number } {
  const available = Math.max(0, Math.floor(acc / tickMs));
  const frameCap = available > maxTicks ? Math.max(maxTicks, MAX_CATCH_UP_TICKS_PER_FRAME) : maxTicks;
  const ticks = Math.min(available, frameCap);
  return { ticks, acc: Math.max(0, acc - ticks * tickMs) };
}

export type LoopHandle = {
  stop: () => void;
};

export type LoopOptions = {
  getState: () => SimState;
  setState: (s: SimState) => void;
  drainCommands: () => Command[];
  isPaused?: () => boolean;
  onFrame?: (now: number, state: SimState, paused: boolean, subTickAlpha: number) => void;
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
      onFrame?.(now, state, true, 0);
      raf = requestAnimationFrame(frame);
      return;
    }
    acc += now - last;
    last = now;
    const budget = frameTickBudget(acc);
    acc = budget.acc;
    for (let i = 0; i < budget.ticks && state.result === "playing"; i++) {
      const cmds = drainCommands();
      const out = tick(state, cmds.length ? cmds : undefined);
      state = out.state;
      setState(state);
      onTick?.(state, out.events, now);
      onEvents?.(out.events);
    }
    if (state.result !== "playing") acc = 0;
    const subTickAlpha = state.result === "playing" ? Math.max(0, Math.min(1, acc / TICK_MS)) : 1;
    onFrame?.(now, state, false, subTickAlpha);
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
