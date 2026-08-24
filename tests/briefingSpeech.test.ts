// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BriefingLine } from "../lib/types";
import { useBriefingSpeech } from "../components/briefing/useBriefingSpeech";
import { defaultSettings } from "../lib/persist/settings";

class FakeUtterance {
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;

  constructor(public text: string) {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("briefing speech", () => {
  it("speaks each active line with a role-specific delivery and cancels on replay", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const speech = {
      getVoices: vi.fn(() => [{ lang: "en-US" }]),
      speak,
      cancel,
    } as unknown as SpeechSynthesis;
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    const lines: BriefingLine[] = [
      { speaker: "advisor", text: "Signal is clean." },
      { speaker: "enemyLeader", text: "You are already too late." },
    ];
    const { rerender } = renderHook(
      ({ activeLineIndex, playId }: { activeLineIndex: number; playId: number }) =>
        useBriefingSpeech(lines, activeLineIndex, playId),
      { initialProps: { activeLineIndex: 0, playId: 0 } },
    );

    expect(speak).toHaveBeenCalledOnce();
    const first = speak.mock.calls[0]![0] as FakeUtterance;
    expect(first.text).toBe(lines[0]!.text);
    expect(first.pitch).toBeGreaterThan(1);
    expect(first.volume).toBeCloseTo(0.86 * defaultSettings().sfxVolume);

    rerender({ activeLineIndex: 1, playId: 0 });
    expect(speak).toHaveBeenCalledTimes(2);
    expect(cancel).not.toHaveBeenCalled();
    const second = speak.mock.calls[1]![0] as FakeUtterance;
    expect(second.text).toBe(lines[1]!.text);
    expect(second.pitch).toBeLessThan(first.pitch);

    rerender({ activeLineIndex: -1, playId: 1 });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not speak when sound effects are disabled", () => {
    const speak = vi.fn();
    const speech = {
      getVoices: vi.fn(() => []),
      speak,
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({
        version: 2,
        settings: { ...defaultSettings(), sfxEnabled: false },
      }),
    });

    renderHook(() => useBriefingSpeech([{ speaker: "commander", text: "Hold." }], 0, 0));
    expect(speak).not.toHaveBeenCalled();
  });
});
