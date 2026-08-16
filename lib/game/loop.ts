import { tick } from "../sim/api";
import type { Command, SimEvent, SimState } from "../types";

export const TICK_MS = 1000 / 12;

export type LoopHandle = {
  stop: () => void;
};

export function startLoop(
  getState: () => SimState,
  setState: (s: SimState) => void,
  drainCommands: () => Command[],
  onEvents?: (events: SimEvent[]) => void,
): LoopHandle {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  const frame = (now: number) => {
    if (stopped) return;
    acc += now - last;
    last = now;
    let state = getState();
    while (acc >= TICK_MS && state.result === "playing") {
      const cmds = drainCommands();
      const out = tick(state, cmds.length ? cmds : undefined);
      state = out.state;
      setState(state);
      onEvents?.(out.events);
      acc -= TICK_MS;
    }
    if (state.result !== "playing") acc = 0;
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
