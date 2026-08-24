import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import { listSaves, listUnreadableSaves, localStorageAdapter, removeSave } from "@/lib/persist/save";
import { readCampaignProgress } from "@/lib/persist/campaign";
import { defaultSettings, readSettings, type GameSettings } from "@/lib/persist/settings";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { isEditableTarget, menuCommandFromKey } from "@/lib/ui/shortcuts";
import { useAudioPreferences } from "@/components/audio/useAudioPreferences";
import type { MenuView } from "./MenuOverlay";
import { menuLaunchPath, rollSeed } from "./menuLaunch";

export function useMenuController() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [saves, setSaves] = useState(() => [] as ReturnType<typeof listSaves>);
  const [unreadableSaves, setUnreadableSaves] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState<MenuView>("main");
  const [settings, setSettings] = useState<GameSettings>(() => defaultSettings());
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggleSound, toggleMusic, updateVolume } = useAudioPreferences(settings, setSettings);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storage = localStorageAdapter();
      setSaves(listSaves(storage));
      setUnreadableSaves(listUnreadableSaves(storage));
      setSettings(readSettings(storage));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const preview = useMemo(() => {
    const seed = parseSeed(code);
    if (seed === null || code.length < 4) return null;
    return createCampaign(seed);
  }, [code]);

  const openNewGame = useCallback(() => {
    setCode((current) => current.length === 4 ? current : rollSeed());
    setError("");
    setView("newGame");
  }, []);

  const openOptions = useCallback(() => setView("options"), []);

  const openOperations = useCallback(() => {
    const seed = parseSeed(code);
    if (seed === null || code.length < 4) {
      setError("Enter a 4-digit seed before opening the operations map.");
      return;
    }
    setError("");
    router.push(`/campaign?seed=${formatSeed(seed)}`);
  }, [code, router]);
  const randomize = useCallback(() => {
    setCode(rollSeed());
    setError("");
  }, []);

  const launch = useCallback(() => {
    const seed = parseSeed(code);
    const progress = seed === null ? null : readCampaignProgress(localStorageAdapter(), seed);
    const path = menuLaunchPath(code, progress?.tutorialComplete ?? false);
    if (!path) {
      setError("Enter a 4-digit seed (0000–9999), or roll a random theater.");
      return;
    }
    setError("");
    router.push(path);
  }, [code, router]);

  const deleteSave = useCallback((saveSeed: string) => {
    const storage = localStorageAdapter();
    removeSave(storage, Number(saveSeed));
    setSaves(listSaves(storage));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  const resetUnreadableSave = useCallback((saveSeed: string) => {
    const storage = localStorageAdapter();
    removeSave(storage, Number(saveSeed));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = menuCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        setupOpen: view === "newGame",
        optionsOpen: view === "options",
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "newGame") openNewGame();
      else if (command.type === "options") openOptions();
      else if (command.type === "toggleSound") toggleSound();
      else if (command.type === "toggleMusic") toggleMusic();
      else if (command.type === "deploy") launch();
      else if (command.type === "randomize") randomize();
      else if (command.type === "back") setView("main");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openNewGame, openOptions, toggleSound, toggleMusic, launch, randomize]);

  return {
    code,
    saves,
    unreadableSaves,
    error,
    view,
    settings,
    inputRef,
    previewLine: preview
      ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
      : "Four digits lock a theater — or roll a random war",
    openNewGame,
    openOptions,
    openOperations,
    randomize,
    launch,
    toggleSound,
    toggleMusic,
    updateVolume,
    deleteSave,
    resetUnreadableSave,
    setCode: (value: string) => {
      setCode(value);
      setError("");
    },
    goBack: () => setView("main"),
    resume: (seed: string) => router.push(`/play?seed=${seed}&resume=1`),
    openCampaign: (seed: string) => router.push(`/campaign?seed=${seed}`),
  };
}
