import { useEffect, useRef, useState } from "react";
import { localStorageAdapter } from "@/lib/persist/save";
import { readSettings } from "@/lib/persist/settings";
import type { Command } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";

export function useGameChrome() {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CommandTab>("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(false);
  const campaignRecordedRef = useRef(false);
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [audioSettings, setAudioSettings] = useState(() => readSettings(localStorageAdapter()));
  const cmdQ = useRef<Command[]>([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    pauseViewRef.current = pauseView;
  }, [pauseView]);

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
    audioSettings,
    setAudioSettings,
    cmdQ,
  };
}
