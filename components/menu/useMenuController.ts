import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import {
  listSaves,
  listUnreadableSaves,
  localStorageAdapter,
  hasSaveForSeed,
  parseSaveExport,
  removeSave,
  type ParsedSaveExport,
} from "@/lib/persist/save";
import { readCampaignProgress } from "@/lib/persist/campaign";
import { importSaveAtomically } from "@/lib/persist/saveTransfer";
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
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    save: ParsedSaveExport;
    collision: boolean;
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggleSound, toggleMusic, toggleTacticalRoster, updateVolume } = useAudioPreferences(settings, setSettings);

  const refreshSaves = useCallback(() => {
    const storage = localStorageAdapter();
    setSaves(listSaves(storage));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storage = localStorageAdapter();
      refreshSaves();
      setSettings(readSettings(storage));
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshSaves]);

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
    refreshSaves();
  }, [refreshSaves]);

  const resetUnreadableSave = useCallback((saveSeed: string) => {
    const storage = localStorageAdapter();
    removeSave(storage, Number(saveSeed));
    refreshSaves();
  }, [refreshSaves]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError("");
    setImportNotice("");
    try {
      const parsed = parseSaveExport(await file.text());
      const collision = hasSaveForSeed(localStorageAdapter(), parsed.state.seed);
      setImportPreview({ fileName: file.name, save: parsed, collision });
    } catch (cause) {
      setImportPreview(null);
      setImportError(cause instanceof Error ? cause.message : "Unable to read save file");
    }
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPreview) return;
    const imported = importSaveAtomically(localStorageAdapter(), importPreview.save);
    if (!imported) {
      setImportError("Import failed: browser storage could not be updated.");
      return;
    }
    setImportPreview(null);
    setImportNotice(`Imported save ${formatSeed(importPreview.save.state.seed)}. Choose Resume or Operations when ready.`);
    refreshSaves();
  }, [importPreview, refreshSaves]);

  const cancelImport = useCallback(() => {
    setImportPreview(null);
    setImportError("");
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
    importPreview,
    importError,
    importNotice,
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
    toggleTacticalRoster,
    updateVolume,
    deleteSave,
    resetUnreadableSave,
    handleImportFile,
    confirmImport,
    cancelImport,
    setCode: (value: string) => {
      setCode(value);
      setError("");
    },
    goBack: () => setView("main"),
    resume: (seed: string) => router.push(`/play?seed=${seed}&resume=1`),
    openCampaign: (seed: string) => router.push(`/campaign?seed=${seed}`),
  };
}
