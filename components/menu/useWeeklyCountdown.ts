import { useEffect, useState } from "react";
import { formatWeeklyCountdown, weeklyIndex } from "./menuLaunch";

export function useWeeklyCountdown() {
  const [countdown, setCountdown] = useState(() => formatWeeklyCountdown());
  const [week, setWeek] = useState(() => weeklyIndex());

  useEffect(() => {
    const update = () => {
      setCountdown(formatWeeklyCountdown());
      setWeek(weeklyIndex());
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { countdown, week };
}
