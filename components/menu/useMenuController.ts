import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import { cachedLocalStorage } from "@/lib/persist/save";
import { defaultSettings, readSettings, type GameSettings } from "@/lib/persist/settings";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { isEditableTarget, menuCommandFromKey } from "@/lib/ui/shortcuts";
import { useAudioPreferences } from "@/components/audio/useAudioPreferences";
import type { MenuView } from "./MenuOverlay";
import { tutorialPath } from "../game/hooks/missionRoutes";
import { menuLaunchPath, rollSeed } from "./menuLaunch";

export function useMenuController() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<MenuView>("main");
  const [settings, setSettings] = useState<GameSettings>(() => defaultSettings());
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggleSound, toggleMusic, toggleTacticalRoster, updateVolume } = useAudioPreferences(settings, setSettings);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storage = cachedLocalStorage();
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
  const openLoadMission = useCallback(() => router.push("/load"), [router]);
  const openTutorial = useCallback(() => router.push(tutorialPath()), [router]);

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
    const path = menuLaunchPath(code);
    if (!path) {
      setError("Enter a 4-digit seed (0000–9999), or roll a random theater.");
      return;
    }
    setError("");
    router.push(path);
  }, [code, router]);

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
      else if (command.type === "tutorial") openTutorial();
      else if (command.type === "loadMission") openLoadMission();
      else if (command.type === "options") openOptions();
      else if (command.type === "toggleSound") toggleSound();
      else if (command.type === "toggleMusic") toggleMusic();
      else if (command.type === "deploy") launch();
      else if (command.type === "randomize") randomize();
      else if (command.type === "back") setView("main");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openNewGame, openTutorial, openLoadMission, openOptions, toggleSound, toggleMusic, launch, randomize]);

  return {
    code,
    error,
    view,
    settings,
    inputRef,
    previewLine: preview
      ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
      : "Four digits lock a theater — or roll a random war",
    openNewGame,
    openTutorial,
    openLoadMission,
    openOptions,
    openOperations,
    randomize,
    launch,
    toggleSound,
    toggleMusic,
    toggleTacticalRoster,
    updateVolume,
    setCode: (value: string) => {
      setCode(value);
      setError("");
    },
    goBack: () => setView("main"),
  };
}
