import type { MusicIntensity } from "@/lib/audio/music";
import type { MissionDirectorPhase, SimEvent } from "@/lib/types";

export function desiredMusicIntensity(
  phase: MissionDirectorPhase | undefined,
  tick: number,
  lastCombatTick: number,
  warningAlert: boolean,
): MusicIntensity {
  let desired: MusicIntensity = phase === "finale" ? "critical" : phase === "pressure" ? "engaged" : "calm";
  if (tick - lastCombatTick <= 48) desired = desired === "critical" ? desired : "engaged";
  if (warningAlert) desired = "critical";
  return desired;
}

export function firstAlert(events: SimEvent[]) {
  const alert = events.find((event) => event.type === "alert");
  return alert?.type === "alert" ? alert : undefined;
}

export function warningAlert(events: SimEvent[]): boolean {
  return firstAlert(events)?.kind === "warning";
}

export function alertSfx(kind: "warning" | "objective" | "contact") {
  return kind === "warning" ? "warning" : kind === "objective" ? "objective" : "contact";
}
