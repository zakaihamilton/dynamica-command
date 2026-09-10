import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { SimState } from "@/lib/types";
import type { MissionUxTelemetry } from "@/lib/persist/telemetry";

export function useGameSelection({
  stateRef,
  setState,
  uxRef,
}: {
  stateRef: MutableRefObject<SimState>;
  setState: (state: SimState) => void;
  uxRef?: MutableRefObject<MissionUxTelemetry>;
}) {
  const selected = useRef(new Set<number>());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const selectionModeRef = useRef(false);

  const commitSelection = useCallback((ids: number[]) => {
    selected.current = new Set(ids);
    setSelectedIds(ids);
    if (ids.length > 0 && uxRef && uxRef.current.firstSelectionTick === undefined) {
      uxRef.current.firstSelectionTick = stateRef.current.tick;
    }
    const current = stateRef.current;
    if (current.tutorialStage === "select" && ids.some((id) => {
      const entity = current.entities.find((item) => item.id === id);
      return entity?.owner === 0 && entity.class === "unit" && entity.kind === "infantry" && !entity.neutral;
    })) {
      current.tutorialStage = "move";
      setState({ ...current, entities: [...current.entities] });
    }
  }, [setState, stateRef, uxRef]);

  const setSelectionModeState = useCallback((active: boolean) => {
    selectionModeRef.current = active;
    setSelectionMode(active);
  }, []);

  return {
    selected,
    selectedIds,
    selectionMode,
    selectionModeRef,
    commitSelection,
    setSelectionMode: setSelectionModeState,
  };
}
