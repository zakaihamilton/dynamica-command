import { describe, expect, it } from "vitest";
import {
  assetsCommandFromKey,
  briefingCommandFromKey,
  cameoIndexFromEvent,
  gameCommandFromKey,
  isEditableTarget,
  menuCommandFromKey,
} from "../lib/ui/shortcuts";

const play = {
  typing: false,
  playing: true,
  paused: false,
  pauseView: "main" as const,
  result: "playing" as const,
  toolActive: false,
};

describe("shortcut matching", () => {
  it("treats form fields as typing targets so hotkeys stay out of the way", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "button" })).toBe(false);
    expect(isEditableTarget({ isContentEditable: true, tagName: "DIV" })).toBe(true);
  });

  it("maps number keys and Digit codes onto cameo slots", () => {
    expect(cameoIndexFromEvent({ key: "3" })).toBe(2);
    expect(cameoIndexFromEvent({ key: "!", code: "Digit1" })).toBe(0);
    expect(cameoIndexFromEvent({ key: "9" })).toBeNull();
  });

  it("picks battlefield commands without stealing WASD pan", () => {
    expect(gameCommandFromKey({ key: "q" }, play)).toEqual({ type: "tab", tab: "construction" });
    expect(gameCommandFromKey({ key: "e" }, play)).toEqual({ type: "tab", tab: "production" });
    expect(gameCommandFromKey({ key: "t" }, play)).toEqual({ type: "tab", tab: "selected" });
    expect(gameCommandFromKey({ key: "Escape" }, play)).toEqual({ type: "pause" });
    expect(gameCommandFromKey({ key: "h" }, play)).toEqual({ type: "home" });
    expect(gameCommandFromKey({ key: " " }, play)).toEqual({ type: "center" });
    expect(gameCommandFromKey({ key: "r" }, play)).toEqual({ type: "repair" });
    expect(gameCommandFromKey({ key: "f" }, play)).toEqual({ type: "sell" });
    expect(gameCommandFromKey({ key: "x" }, play)).toEqual({ type: "stop" });
    expect(gameCommandFromKey({ key: "Escape" }, { ...play, toolActive: true })).toEqual({ type: "cancelTool" });
    expect(gameCommandFromKey({ key: "s" }, play)).toBeNull();
    expect(gameCommandFromKey({ key: "2" }, play)).toEqual({ type: "cameo", index: 1, cancel: false });
    expect(gameCommandFromKey({ key: "2", ctrlKey: true }, play)).toEqual({ type: "cameo", index: 1, cancel: true });
  });

  it("routes pause-menu letters and pops nested pause views", () => {
    const paused = { ...play, paused: true };
    expect(gameCommandFromKey({ key: "Escape" }, paused)).toEqual({ type: "resume" });
    expect(gameCommandFromKey({ key: "s" }, paused)).toEqual({ type: "save" });
    expect(gameCommandFromKey({ key: "r" }, paused)).toEqual({ type: "restart" });
    expect(gameCommandFromKey({ key: "m" }, paused)).toEqual({ type: "menu" });
    expect(gameCommandFromKey({ key: "Escape" }, { ...paused, pauseView: "options" })).toEqual({ type: "pauseBack" });
    expect(gameCommandFromKey({ key: "m" }, { ...paused, pauseView: "options" })).toEqual({ type: "toggleSound" });
    expect(gameCommandFromKey({ key: "u" }, { ...paused, pauseView: "options" })).toEqual({ type: "toggleMusic" });
    expect(gameCommandFromKey({ key: "Escape" }, { ...paused, pauseView: "assets" })).toBeNull();
  });

  it("uses Enter and Esc on the mission-result overlay", () => {
    expect(gameCommandFromKey({ key: "Enter" }, { ...play, result: "won" })).toEqual({ type: "resultPrimary" });
    expect(gameCommandFromKey({ key: "Escape" }, { ...play, result: "lost" })).toEqual({ type: "resultMenu" });
    expect(gameCommandFromKey({ key: "q" }, { ...play, result: "won" })).toBeNull();
  });

  it("ignores typing, repeats, and menu keys that would clash with an open overlay", () => {
    expect(gameCommandFromKey({ key: "q" }, { ...play, typing: true })).toBeNull();
    expect(gameCommandFromKey({ key: "q", repeat: true }, play)).toBeNull();
    expect(menuCommandFromKey({ key: "n" }, { typing: false, setupOpen: false })).toEqual({ type: "newGame" });
    expect(menuCommandFromKey({ key: "a" }, { typing: false, setupOpen: false })).toBeNull();
    expect(menuCommandFromKey({ key: "Enter" }, { typing: false, setupOpen: false })).toBeNull();
    expect(menuCommandFromKey({ key: "Enter" }, { typing: false, setupOpen: true })).toEqual({ type: "deploy" });
    expect(menuCommandFromKey({ key: "r" }, { typing: false, setupOpen: true })).toEqual({ type: "randomize" });
    expect(menuCommandFromKey({ key: "Escape" }, { typing: true, setupOpen: true })).toEqual({ type: "back" });
    expect(briefingCommandFromKey({ key: " " }, { typing: false, revealed: false })).toEqual({ type: "skip" });
    expect(briefingCommandFromKey({ key: " " }, { typing: false, revealed: true })).toEqual({ type: "launch" });
    expect(briefingCommandFromKey({ key: "Enter" }, { typing: false, revealed: true })).toEqual({ type: "launch" });
    expect(briefingCommandFromKey({ key: "r" }, { typing: false, revealed: false })).toEqual({ type: "replay" });
    expect(briefingCommandFromKey({ key: "r" }, { typing: false, revealed: true })).toEqual({ type: "replay" });
    expect(briefingCommandFromKey({ key: "r" }, { typing: false, revealed: true, returnToGame: true })).toEqual({ type: "replay" });
    expect(briefingCommandFromKey({ key: "Escape" }, { typing: false, revealed: true, returnToGame: true })).toEqual({ type: "launch" });
    expect(briefingCommandFromKey({ key: "Enter" }, { typing: false, revealed: true, returnToGame: true })).toBeNull();
    expect(assetsCommandFromKey({ key: "Escape" }, { typing: false })).toEqual({ type: "close" });
    expect(assetsCommandFromKey({ key: " " }, { typing: false })).toEqual({ type: "togglePlay" });
  });

  it("steps through the asset bay with up and down arrows", () => {
    expect(assetsCommandFromKey({ key: "ArrowUp" }, { typing: false })).toEqual({ type: "prevAsset" });
    expect(assetsCommandFromKey({ key: "ArrowDown" }, { typing: false })).toEqual({ type: "nextAsset" });
    expect(assetsCommandFromKey({ key: "ArrowDown", repeat: true }, { typing: false })).toEqual({ type: "nextAsset" });
    expect(assetsCommandFromKey({ key: "ArrowUp" }, { typing: true })).toBeNull();
    expect(assetsCommandFromKey({ key: "ArrowDown", ctrlKey: true }, { typing: false })).toBeNull();
  });
});
