import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Keeps browser Back inside an active mission long enough to show the same
 * confirmation used by the pause menu. Once confirmed, the original history
 * entry is restored and the browser performs the pending Back navigation.
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
  const currentHistoryStateRef = useRef<unknown>(null);

  const leave = useCallback(() => {
    if (!activeRef.current || typeof window === "undefined") return;
    allowBackRef.current = true;
    window.history.back();
  }, []);

  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") {
      activeRef.current = false;
      return;
    }

    activeRef.current = true;
    currentUrlRef.current = window.location.href;
    currentHistoryStateRef.current = window.history.state;
    const onPopState = (event: PopStateEvent) => {
      if (allowBackRef.current) {
        allowBackRef.current = false;
        return;
      }

      // Register in a layout effect and stop the router's popstate listener
      // before it can unmount the mission. Confirmed Back navigations are
      // allowed through on the next history event.
      event.stopImmediatePropagation();
      // The browser has already moved to the previous route. Re-add the
      // mission URL so cancelling the dialog leaves the user in the mission.
      window.history.pushState(currentHistoryStateRef.current, "", currentUrlRef.current);
      onRequestLeave();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      activeRef.current = false;
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled, onRequestLeave]);

  return { leave };
}
