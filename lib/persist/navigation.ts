const FRESH_LAUNCH_INTENT_KEY = "genesis-protocol:fresh-launch";

type FreshLaunchIntent = {
  seed: number;
  mission: number;
};

let memoryFreshLaunchIntent: FreshLaunchIntent | null = null;

function sessionStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markFreshLaunchIntent(seed: number, mission: number): void {
  const intent = { seed, mission } satisfies FreshLaunchIntent;
  const storage = sessionStorageOrNull();
  if (!storage) {
    memoryFreshLaunchIntent = intent;
    return;
  }
  try {
    storage.setItem(FRESH_LAUNCH_INTENT_KEY, JSON.stringify(intent));
    memoryFreshLaunchIntent = null;
  } catch {
    // Keep the intent in memory when a blocked or exhausted session store cannot persist it.
    memoryFreshLaunchIntent = intent;
  }
}

export function consumeFreshLaunchIntent(seed: number, mission: number): boolean {
  const memoryIntent = memoryFreshLaunchIntent;
  memoryFreshLaunchIntent = null;
  const storage = sessionStorageOrNull();
  if (!storage) return memoryIntent?.seed === seed && memoryIntent.mission === mission;

  let raw: string | null;
  try {
    raw = storage.getItem(FRESH_LAUNCH_INTENT_KEY);
  } catch {
    return memoryIntent?.seed === seed && memoryIntent.mission === mission;
  }

  if (raw !== null) {
    try {
      storage.removeItem(FRESH_LAUNCH_INTENT_KEY);
    } catch {
      // Treat the marker as consumed even if cleanup is unavailable.
    }
  }

  if (memoryIntent?.seed === seed && memoryIntent.mission === mission) return true;
  if (!raw) return false;
  try {
    const intent = JSON.parse(raw) as Partial<FreshLaunchIntent>;
    return intent.seed === seed && intent.mission === mission;
  } catch {
    return false;
  }
}
