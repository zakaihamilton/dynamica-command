// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const audioState = vi.hoisted(() => ({ unlocked: false }));
const unlockAudio = vi.hoisted(() => vi.fn(() => {
  audioState.unlocked = true;
}));
const isAudioUnlocked = vi.hoisted(() => vi.fn(() => audioState.unlocked));

vi.mock("next/navigation", () => ({
  usePathname: () => "/play",
  useSearchParams: () => new URLSearchParams("seed=421&mission=0"),
}));

vi.mock("../../lib/audio/music", () => ({
  TITLE_MUSIC_SEED: 0,
  TUTORIAL_MUSIC_MISSION: -1,
  musicCueFromPath: vi.fn(() => "mission"),
  pauseMusic: vi.fn(),
  setMusicCue: vi.fn(),
  setMusicEnabled: vi.fn(),
  isAudioUnlocked,
  unlockAudio,
  saveAudibleMusicPosition: vi.fn(),
}));

vi.mock("../../lib/audio/synth", () => ({ setSfxEnabled: vi.fn() }));
vi.mock("../../lib/audio/mixer", () => ({ setAudioLevels: vi.fn() }));

import { AudioRoot } from "../../components/audio/AudioRoot";

afterEach(() => {
  cleanup();
  audioState.unlocked = false;
  unlockAudio.mockClear();
  isAudioUnlocked.mockClear();
});

describe("AudioRoot unlock handling", () => {
  it("captures document gestures and retries unlock on later gestures", () => {
    render(<AudioRoot />);

    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
      document.dispatchEvent(new Event("pointerdown"));
    });

    expect(unlockAudio).toHaveBeenCalledTimes(2);
  });
});
