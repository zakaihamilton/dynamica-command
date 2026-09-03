import { describe, expect, it } from "vitest";
import { briefingActiveLineIndex, wrapBreakOffsets, briefingLineStarts, briefingRevealedLines } from "../../components/briefing/briefingWrap";

const byLength = (s: string) => s.length;

describe("briefing wrap breaks", () => {
  it("breaks before a word that would not fit on the current line", () => {
    expect(wrapBreakOffsets("one two three four", 10, byLength)).toEqual([8]);
  });

  it("inserts a break for each wrapped word", () => {
    expect(wrapBreakOffsets("aaaaa bbbbb ccccc", 8, byLength)).toEqual([6, 12]);
  });

  it("does not break before the first word even if it is wider than the line", () => {
    expect(wrapBreakOffsets("hello", 3, byLength)).toEqual([]);
  });

  it("returns no breaks when everything fits", () => {
    expect(wrapBreakOffsets("hold the line", 80, byLength)).toEqual([]);
  });
});

describe("briefing typewriter reveal", () => {
  const lines = [
    { speaker: "commander" as const, text: "Hold" },
    { speaker: "advisor" as const, text: "the line" },
  ];

  it("precomputes prefix sums for line starts", () => {
    expect(briefingLineStarts(lines)).toEqual([0, 4, 12]);
  });

  it("reveals characters without scanning prior lines each time", () => {
    expect(briefingRevealedLines(lines, 0).map((line) => line.visible)).toEqual(["", ""]);
    expect(briefingRevealedLines(lines, 3).map((line) => ({
      visible: line.visible,
      started: line.started,
      complete: line.complete,
    }))).toEqual([
      { visible: "Hol", started: true, complete: false },
      { visible: "", started: false, complete: false },
    ]);
    expect(briefingRevealedLines(lines, 6).map((line) => line.visible)).toEqual(["Hold", "th"]);
    const done = briefingRevealedLines(lines, 12);
    expect(done.every((line) => line.complete)).toBe(true);
    expect(done.map((line) => line.visible)).toEqual(["Hold", "the line"]);
  });

  it("identifies the line being spoken while the transmission is typing", () => {
    expect(briefingActiveLineIndex(lines, 0)).toBe(-1);
    expect(briefingActiveLineIndex(lines, 2)).toBe(0);
    expect(briefingActiveLineIndex(lines, 4)).toBe(0);
    expect(briefingActiveLineIndex(lines, 5)).toBe(1);
    expect(briefingActiveLineIndex(lines, 12)).toBe(-1);
  });
});
