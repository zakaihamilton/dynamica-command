import { afterEach, describe, expect, it, vi } from "vitest";
import { createMission, tick } from "../lib/sim/api";
import { MAX_CATCH_UP_TICKS_PER_FRAME, MAX_TICKS_PER_FRAME, TICK_MS, frameTickBudget, startLoop } from "../lib/game/loop";

type Listener = () => void;

function eventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener(type: string, listener: Listener) {
      const typeListeners = listeners.get(type) ?? new Set<Listener>();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type: string) {
      listeners.get(type)?.forEach((listener) => listener());
    },
  };
}

describe("sim catch-up budget", () => {
  it("keeps the leftover accumulator under the cap", () => {
    const budget = frameTickBudget(TICK_MS * 2.4);
    expect(budget.ticks).toBe(2);
    expect(budget.acc).toBeCloseTo(TICK_MS * 0.4);
  });

  it("uses a bounded catch-up burst instead of dropping the backlog", () => {
    const budget = frameTickBudget(TICK_MS * 20);
    expect(budget.ticks).toBe(MAX_CATCH_UP_TICKS_PER_FRAME);
    expect(budget.acc).toBeCloseTo(TICK_MS * (20 - MAX_CATCH_UP_TICKS_PER_FRAME));
  });

  it("can consume the retained backlog on the next frame", () => {
    const first = frameTickBudget(TICK_MS * 20.5);
    const next = frameTickBudget(first.acc);
    expect(next.ticks).toBe(20 - MAX_CATCH_UP_TICKS_PER_FRAME);
    expect(next.acc).toBeCloseTo(TICK_MS * 0.5);
  });

  it("keeps the normal frame cap for a small backlog", () => {
    const budget = frameTickBudget(TICK_MS * (MAX_TICKS_PER_FRAME + 0.4));
    expect(budget.ticks).toBe(MAX_TICKS_PER_FRAME);
    expect(budget.acc).toBeCloseTo(TICK_MS * 0.4);
  });

  it("runs no ticks when the accumulator is short", () => {
    expect(frameTickBudget(TICK_MS - 1)).toEqual({ ticks: 0, acc: TICK_MS - 1 });
  });
});

describe("startLoop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("discards the hidden-window backlog when the window is focused again", () => {
    let now = 0;
    let nextRafId = 1;
    const rafs = new Map<number, FrameRequestCallback>();
    const windowTarget = eventTarget();
    const documentTarget = eventTarget();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextRafId++;
      rafs.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafs.delete(id);
    });

    const state = createMission({ seed: 421, missionIndex: 0 });
    const loop = startLoop({
      getState: () => state,
      setState: () => undefined,
      drainCommands: () => [],
      step: tick,
      onTick: () => undefined,
    });

    const flushFrame = (time: number) => {
      now = time;
      const [id, callback] = rafs.entries().next().value as [number, FrameRequestCallback];
      rafs.delete(id);
      callback(time);
    };

    flushFrame(16);
    now = 10_000;
    windowTarget.dispatch("focus");
    flushFrame(10_016);

    expect(state.tick).toBe(0);
    loop.stop();
  });

  it("makes loop cleanup idempotent", () => {
    const raf = vi.fn(() => 1);
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const loop = startLoop({
      getState: () => createMission({ seed: 421, missionIndex: 0 }),
      setState: () => undefined,
      drainCommands: () => [],
      step: tick,
    });

    loop.stop();
    loop.stop();

    expect(cancel).toHaveBeenCalledOnce();
  });
});
