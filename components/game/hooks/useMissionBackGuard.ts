import { useCallback, useLayoutEffect, useRef } from "react";

const MISSION_BACK_SENTINEL = "__genesisMissionBackSentinel";

/**
 * Keeps browser Back inside an active mission long enough to show the same
 * confirmation used by the pause menu. A same-URL sentinel means the router
 * never traverses to the previous screen while the confirmation is open.
 */
export function useMissionBackGuard({
  enabled,
  onRequestLeave,
}: {
  enabled: boolean;
  onRequestLeave: () => void;
}) {
  const activeRef = useRef(false);
  const allowBackRef = useRef(false);
  const currentUrlRef = useRef("");

  const leave = useCallback(() => {
    if (!activeRef.current || typeof window === "undefined") return;
    allowBackRef.current = true;
    // Skip the sentinel and the original mission entry to reach the route
    // that was underneath the mission.
    window.history.go(-2);
  }, []);

  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") {
      activeRef.current = false;
      return;
    }

    activeRef.current = true;
    currentUrlRef.current = window.location.href;
    const currentHistoryState = window.history.state;
    const sentinelState = {
      ...(currentHistoryState && typeof currentHistoryState === "object" ? currentHistoryState : {}),
      [MISSION_BACK_SENTINEL]: true,
    };
    // Keep one same-URL entry ahead of the mission so a native Back event
    // lands on another mission entry instead of the previous route.
    window.history.pushState(sentinelState, "", currentUrlRef.current);
    const onPopState = (event: PopStateEvent) => {
      if (allowBackRef.current) {
        allowBackRef.current = false;
        return;
      }

      // Forward returns to the sentinel. It is still the active mission and
      // must not open a leave confirmation.
      if (event.state && typeof event.state === "object" && MISSION_BACK_SENTINEL in event.state) return;

      // The browser has traversed from the sentinel to the original mission
      // entry. Re-add the sentinel so cancelling leaves the user in the
      // mission and the next Back is guarded in the same way.
      event.stopImmediatePropagation();
      window.history.pushState(sentinelState, "", currentUrlRef.current);
      onRequestLeave();
    };

    window.addEventListener("popstate", onPopState, true);
    return () => {
      activeRef.current = false;
      window.removeEventListener("popstate", onPopState, true);
    };
  }, [enabled, onRequestLeave]);

  return { leave };
}
