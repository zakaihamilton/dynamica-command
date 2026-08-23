import { useCallback, useEffect, useRef, useState } from "react";

export function useCombatAlert() {
  const [combatAlert, setCombatAlert] = useState<string | null>(null);
  const clearRef = useRef<number | null>(null);

  const onAlert = useCallback((text: string) => {
    setCombatAlert(text);
    if (clearRef.current) window.clearTimeout(clearRef.current);
    clearRef.current = window.setTimeout(() => {
      setCombatAlert(null);
      clearRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (clearRef.current) window.clearTimeout(clearRef.current);
  }, []);

  return { combatAlert, onAlert };
}
