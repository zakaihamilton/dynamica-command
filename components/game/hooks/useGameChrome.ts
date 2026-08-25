import { useCallback, useEffect, useRef, useState } from "react";
import { localStorageAdapter } from "@/lib/persist/save";
import { readSettings } from "@/lib/persist/settings";
import type { Command, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";

export function useGameChrome(initialResult: SimState["result"] = "playing") {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CommandTab>("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(initialResult !== "playing");
  const campaignRecordedRef = useRef(initialResult === "won");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [tacticalAnnouncement, setTacticalAnnouncement] = useState("");
  const [audioSettings, setAudioSettings] = useState(() => readSettings(localStorageAdapter()));
  const cmdQ = useRef<Command[]>([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    pauseViewRef.current = pauseView;
  }, [pauseView]);

  const announceTactical = useCallback((message: string) => setTacticalAnnouncement(message), []);

  return {
    mobileSheetOpen,
    setMobileSheetOpen,
    activeTab,
    setActiveTab,
    activeTabRef,
    paused,
    setPaused,
    pausedRef,
    terminalSaveRef,
    campaignRecordedRef,
    pauseView,
    setPauseView,
    pauseViewRef,
    pauseNotice,
    setPauseNotice,
    tacticalAnnouncement,
    announceTactical,
    audioSettings,
    setAudioSettings,
    cmdQ,
  };
}
