import type { Entity, SimEvent, SimState } from "../../types";

export type PendingAlerts = { harvester: boolean; yard: boolean; convoy: boolean };

const ALERT_MUTE_TICKS = 72;

export function notePlayerAlert(attacker: Entity, target: Entity, pending: PendingAlerts): void {
  if (attacker.owner !== 1 || target.owner !== 0) return;
  if (target.kind === "constructionYard") pending.yard = true;
  else if (target.scenarioRole === "convoy") pending.convoy = true;
  else if (target.kind === "harvester") pending.harvester = true;
}

export function flushPlayerAlerts(state: SimState, pending: PendingAlerts, events: SimEvent[]): void {
  const category = pending.yard ? "yard" : pending.convoy ? "convoy" : pending.harvester ? "harvester" : undefined;
  if (!category) return;
  const mute = alertMute.get(state) ?? {
    harvesterUntil: Number.NEGATIVE_INFINITY,
    yardUntil: Number.NEGATIVE_INFINITY,
    convoyUntil: Number.NEGATIVE_INFINITY,
  };
  const until = category === "yard" ? mute.yardUntil : category === "convoy" ? mute.convoyUntil : mute.harvesterUntil;
  if (state.tick < until) return;
  if (category === "yard") mute.yardUntil = state.tick + ALERT_MUTE_TICKS;
  else if (category === "convoy") mute.convoyUntil = state.tick + ALERT_MUTE_TICKS;
  else mute.harvesterUntil = state.tick + ALERT_MUTE_TICKS;
  alertMute.set(state, mute);
  events.push(
    category === "yard"
      ? { type: "alert", kind: "warning", text: "Construction yard under attack" }
      : category === "convoy"
        ? { type: "alert", kind: "contact", text: "Convoy under attack" }
        : { type: "alert", kind: "contact", text: "Harvester under attack" },
  );
}

const alertMute = new WeakMap<SimState, { harvesterUntil: number; yardUntil: number; convoyUntil: number }>();
