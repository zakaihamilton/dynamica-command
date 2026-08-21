import { describe, expect, it } from "vitest";
import { MAX_CATCH_UP_TICKS_PER_FRAME, MAX_TICKS_PER_FRAME, TICK_MS, frameTickBudget } from "../lib/game/loop";

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
