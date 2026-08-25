// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundtrackPanel } from "../components/audio/SoundtrackPanel";
import { useSoundtrackExport } from "../components/audio/useSoundtrackExport";

const audioMock = vi.hoisted(() => ({
  supportsM4aExport: vi.fn(() => Promise.resolve(true)),
  exportMissionSoundtrack: vi.fn(),
  downloadMusicExport: vi.fn(),
}));

vi.mock("../lib/audio/export", () => audioMock);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("soundtrack export cancellation", () => {
  it("updates immediately, blocks stale download/progress, and permits a later export", async () => {
    let resolveFirst: (value: { blob: Blob; filename: string }) => void = () => undefined;
    audioMock.exportMissionSoundtrack.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }));
    const { result } = renderHook(() => useSoundtrackExport({ seed: 421, missionIndex: 0, onClose: vi.fn() }));
    await waitFor(() => expect(result.current.availability).toBe("available"));

    await act(async () => {
      void result.current.exportTrack();
    });
    expect(result.current.exportState).toBe("rendering");
    act(() => result.current.cancelExport());
    expect(result.current.status).toContain("Export cancelled");
    expect(result.current.progress).toBe(0);
    expect(result.current.busy).toBe(false);

    await act(async () => {
      resolveFirst({ blob: new Blob(["late"]), filename: "late.m4a" });
      await Promise.resolve();
    });
    expect(audioMock.downloadMusicExport).not.toHaveBeenCalled();

    audioMock.exportMissionSoundtrack.mockResolvedValueOnce({ blob: new Blob(["fresh"]), filename: "fresh.m4a" });
    await act(async () => {
      await result.current.exportTrack();
    });
    expect(audioMock.downloadMusicExport).toHaveBeenCalledOnce();
  });

  it("keeps the panel open with a Close action after cancellation", async () => {
    audioMock.exportMissionSoundtrack.mockReturnValue(new Promise(() => undefined));
    const onClose = vi.fn();
    render(<SoundtrackPanel seed={421} missionIndex={0} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download M4A" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Download M4A" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel export" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    expect(screen.getByText(/Export cancelled/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
