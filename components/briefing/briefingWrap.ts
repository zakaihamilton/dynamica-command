/** Start offsets of words that do not fit on the current line and should wrap immediately. */
export function wrapBreakOffsets(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): number[] {
  if (maxWidth <= 0 || text.length === 0) return [];

  const breaks: number[] = [];
  let lineStart = 0;
  const word = /\S+/g;
  for (let match = word.exec(text); match; match = word.exec(text)) {
    const wordStart = match.index;
    if (wordStart === lineStart) continue;
    const wordEnd = wordStart + match[0].length;
    if (measure(text.slice(lineStart, wordEnd)) > maxWidth) {
      breaks.push(wordStart);
      lineStart = wordStart;
    }
  }
  return breaks;
}

export function createTextMeasure(template: HTMLElement): { measure: (text: string) => number; dispose: () => void } {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.whiteSpace = "pre";
  probe.style.top = "0";
  probe.style.left = "0";
  probe.style.pointerEvents = "none";
  const syncFont = () => {
    const next = getComputedStyle(template);
    probe.style.font = next.font;
    probe.style.letterSpacing = next.letterSpacing;
    probe.style.wordSpacing = next.wordSpacing;
  };
  syncFont();
  document.body.appendChild(probe);
  return {
    measure: (text: string) => {
      syncFont();
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    },
    dispose: () => {
      probe.remove();
    },
  };
}
