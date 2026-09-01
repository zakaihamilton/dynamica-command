import { useCallback, useLayoutEffect, useRef } from "react";

const MISSION_BACK_SENTINEL = "__dynamicaCommandMissionBackSentinel";

function isMissionBackSentinel(state: unknown): state is Record<string, unknown> {
  return Boolean(state && typeof state === "object" && MISSION_BACK_SENTINEL in state);
}

function withoutMissionBackSentinel(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  const next = { ...(state as Record<string, unknown>) };
  delete next[MISSION_BACK_SENTINEL];
  return next;
}

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
  const pendingCleanupRef = useRef<(() => void) | null>(null);

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

    // React Strict Mode re-runs effects during development. If the first
    // cleanup consumed the sentinel synchronously, the remounted guard could
    // see that traversal and mistake it for a real browser Back event.
    pendingCleanupRef.current?.();
    pendingCleanupRef.current = null;
    allowBackRef.current = false;
    activeRef.current = true;
    currentUrlRef.current = window.location.href;
    // A previous mission guard can leave a same-URL sentinel in the forward
    // history when the mission is remounted. Strip it before installing the
    // new guard so browser Back never lands on a no-op mission entry.
    const currentHistoryState = withoutMissionBackSentinel(window.history.state);
    if (isMissionBackSentinel(window.history.state)) {
      window.history.replaceState(currentHistoryState, "", currentUrlRef.current);
    }
    const sentinelState = {
      ...currentHistoryState,
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
      if (isMissionBackSentinel(event.state)) return;

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

      // Disabling the guard while the mission is still at its URL (for
      // example after a terminal result) must consume the active sentinel.
      // Otherwise the next Back traverses to a visually identical entry and
      // the user has to press Back twice. The allowed leave path already
      // traverses away from this URL, so it is left untouched.
      let canceled = false;
      const cancel = () => {
        canceled = true;
      };
      pendingCleanupRef.current = cancel;
      queueMicrotask(() => {
        if (canceled) return;
        if (pendingCleanupRef.current === cancel) pendingCleanupRef.current = null;
        if (
          !allowBackRef.current &&
          window.location.href === currentUrlRef.current &&
          isMissionBackSentinel(window.history.state)
        ) {
          window.history.back();
        }
      });
    };
  }, [enabled, onRequestLeave]);

  return { leave };
}
