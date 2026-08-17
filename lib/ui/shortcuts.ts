export type KeyEventLike = {
  key: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type PauseView = "main" | "options" | "assets";

export type GameCommand =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "pauseBack" }
  | { type: "tab"; tab: "construction" | "production" }
  | { type: "cameo"; index: number; cancel: boolean }
  | { type: "home" }
  | { type: "center" }
  | { type: "repair" }
  | { type: "cancelTool" }
  | { type: "save" }
  | { type: "load" }
  | { type: "briefing" }
  | { type: "assets" }
  | { type: "options" }
  | { type: "menu" }
  | { type: "toggleSound" }
  | { type: "resultPrimary" }
  | { type: "resultMenu" };

export type MenuCommand =
  | { type: "newGame" }
  | { type: "deploy" }
  | { type: "randomize" }
  | { type: "back" };
export type BriefingCommand = { type: "launch" } | { type: "skip" };
export type AssetsCommand = { type: "close" } | { type: "togglePlay" };

export const SHORTCUT = {
  pause: "Esc",
  resume: "Esc",
  back: "Esc",
  close: "Esc",
  construction: "Q",
  production: "E",
  cameo: ["1", "2", "3", "4", "5"] as const,
  pan: { up: "W", down: "S", left: "A", right: "D" },
  home: "H",
  center: "Space",
  repair: "R",
  cancelTool: "Esc",
  save: "S",
  load: "L",
  briefing: "B",
  assets: "A",
  options: "O",
  menu: "M",
  mute: "M",
  newGame: "N",
  randomize: "R",
  deploy: "Enter",
  launch: "Enter",
  play: "Space",
  resultPrimary: "Enter",
  resultMenu: "Esc",
} as const;

export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { isContentEditable?: boolean; tagName?: string };
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function cameoIndexFromEvent(e: KeyEventLike): number | null {
  if (e.code && /^Digit[1-5]$/.test(e.code)) return Number(e.code.slice(5)) - 1;
  if (e.key >= "1" && e.key <= "5") return Number(e.key) - 1;
  return null;
}

function letter(e: KeyEventLike): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

function modified(e: KeyEventLike): boolean {
  return !!(e.altKey || e.ctrlKey || e.metaKey);
}

function isEnter(e: KeyEventLike): boolean {
  return e.key === "Enter";
}

function isEscape(e: KeyEventLike): boolean {
  return e.key === "Escape";
}

function isSpace(e: KeyEventLike): boolean {
  return e.key === " " || e.key === "Spacebar" || e.key === "Space";
}

export function gameCommandFromKey(
  e: KeyEventLike,
  ctx: {
    typing: boolean;
    playing: boolean;
    paused: boolean;
    pauseView: PauseView;
    result: "playing" | "won" | "lost";
    toolActive: boolean;
  },
): GameCommand | null {
  if (ctx.typing || e.repeat || e.altKey) return null;
  const ctrl = !!(e.ctrlKey || e.metaKey);
  const key = letter(e);

  if (ctx.result !== "playing") {
    if (ctrl) return null;
    if (isEnter(e)) return { type: "resultPrimary" };
    if (isEscape(e)) return { type: "resultMenu" };
    return null;
  }

  if (ctx.paused) {
    if (ctx.pauseView === "assets") return null;
    if (ctrl) return null;
    if (ctx.pauseView === "options") {
      if (isEscape(e)) return { type: "pauseBack" };
      if (key === "m") return { type: "toggleSound" };
      return null;
    }
    if (isEscape(e)) return { type: "resume" };
    if (key === "s") return { type: "save" };
    if (key === "l") return { type: "load" };
    if (key === "b") return { type: "briefing" };
    if (key === "a") return { type: "assets" };
    if (key === "o") return { type: "options" };
    if (key === "m") return { type: "menu" };
    return null;
  }

  if (!ctx.playing) return null;

  const cameo = cameoIndexFromEvent(e);
  if (cameo !== null) {
    if (e.shiftKey) return null;
    return { type: "cameo", index: cameo, cancel: ctrl };
  }
  if (ctrl) return null;
  if (isEscape(e)) return ctx.toolActive ? { type: "cancelTool" } : { type: "pause" };
  if (key === "q") return { type: "tab", tab: "construction" };
  if (key === "e") return { type: "tab", tab: "production" };
  if (key === "r") return { type: "repair" };
  if (key === "h" || e.key === "Home") return { type: "home" };
  if (isSpace(e)) return { type: "center" };
  return null;
}

export function menuCommandFromKey(
  e: KeyEventLike,
  ctx: { typing: boolean; setupOpen: boolean },
): MenuCommand | null {
  if (e.repeat || modified(e)) return null;
  if (ctx.setupOpen) {
    if (isEscape(e)) return { type: "back" };
    if (ctx.typing) return null;
    if (isEnter(e)) return { type: "deploy" };
    if (letter(e) === "r") return { type: "randomize" };
    return null;
  }
  if (ctx.typing) return null;
  if (letter(e) === "n") return { type: "newGame" };
  return null;
}

export function briefingCommandFromKey(
  e: KeyEventLike,
  ctx: { typing: boolean; revealed: boolean; returnToGame?: boolean },
): BriefingCommand | null {
  if (ctx.typing || e.repeat || modified(e)) return null;
  if (ctx.returnToGame) {
    if (isEscape(e)) return { type: "launch" };
    if (isSpace(e) && !ctx.revealed) return { type: "skip" };
    return null;
  }
  if (isEnter(e)) return { type: "launch" };
  if (isSpace(e)) return ctx.revealed ? { type: "launch" } : { type: "skip" };
  return null;
}

export function assetsCommandFromKey(e: KeyEventLike, ctx: { typing: boolean }): AssetsCommand | null {
  if (ctx.typing || e.repeat || modified(e)) return null;
  if (isEscape(e)) return { type: "close" };
  if (isSpace(e)) return { type: "togglePlay" };
  return null;
}
