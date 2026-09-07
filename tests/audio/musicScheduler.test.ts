// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const resumeAudio = vi.hoisted(() => vi.fn(() => ({ currentTime: 0 })));

vi.mock("../../lib/audio/context", () => ({
  getAudioContext: vi.fn(() => null),
  peekAudioContext: vi.fn(() => null),
  resumeAudio,
}));

import { ensureMusicPlaying } from "../../lib/audio/musicScheduler";
import { setEnabled, setPaused, setPattern, setTimer } from "../../lib/audio/musicState";

afterEach(() => {
  setEnabled(true);
  setPaused(true);
  setPattern(null);
  setTimer(null);
  resumeAudio.mockClear();
});

describe("music scheduler recovery", () => {
  it("resumes an unlocked context even when the scheduler already has a timer", () => {
    setPaused(false);
    setTimer(1);

    ensureMusicPlaying();

    expect(resumeAudio).toHaveBeenCalledOnce();
  });
});
