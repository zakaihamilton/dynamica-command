import { describe, expect, it } from "vitest";
import { MAX_TICKS_PER_FRAME, TICK_MS, frameTickBudget } from "../lib/game/loop";

describe("sim catch-up budget", () => {
  it("keeps the leftover accumulator under the cap", () => {
    const budget = frameTickBudget(TICK_MS * 2.4);
    expect(budget.ticks).toBe(2);
    expect(budget.acc).toBeCloseTo(TICK_MS * 0.4);
  });

  it("drops leftover time after the catch-up cap", () => {
    const budget = frameTickBudget(TICK_MS * 20);
    expect(budget.ticks).toBe(MAX_TICKS_PER_FRAME);
    expect(budget.acc).toBe(0);
  });

  it("runs no ticks when the accumulator is short", () => {
    expect(frameTickBudget(TICK_MS - 1)).toEqual({ ticks: 0, acc: TICK_MS - 1 });
  });
});
