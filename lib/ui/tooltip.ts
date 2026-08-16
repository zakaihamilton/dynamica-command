export type TooltipPos = "above" | "below" | "left" | "right" | "inset";

export type TooltipBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const GAP = 6;
export const TOOLTIP_PAD = 8;

export function parseTooltipPos(value: string | null | undefined): TooltipPos {
  if (value === "below" || value === "left" || value === "right" || value === "inset") return value;
  return "above";
}

export function tooltipMaxBox(
  view: { width: number; height: number },
  pad = TOOLTIP_PAD,
): { width: number; height: number } {
  return {
    width: Math.max(0, view.width - pad * 2),
    height: Math.max(0, view.height - pad * 2),
  };
}

export function placeTooltip(
  anchor: TooltipBox,
  size: { width: number; height: number },
  pos: TooltipPos,
  view: { width: number; height: number },
  gap = GAP,
  pad = TOOLTIP_PAD,
): { top: number; left: number } {
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  let top = 0;
  let left = 0;

  if (pos === "below") {
    top = anchor.top + anchor.height + gap;
    left = cx - size.width / 2;
    if (top + size.height > view.height - pad) top = anchor.top - size.height - gap;
  } else if (pos === "left") {
    top = cy - size.height / 2;
    left = anchor.left - size.width - gap;
    if (left < pad) left = anchor.left + anchor.width + gap;
  } else if (pos === "right") {
    top = cy - size.height / 2;
    left = anchor.left + anchor.width + gap;
    if (left + size.width > view.width - pad) left = anchor.left - size.width - gap;
  } else if (pos === "inset") {
    top = cy - size.height / 2;
    left = cx - size.width / 2;
  } else {
    top = anchor.top - size.height - gap;
    left = cx - size.width / 2;
    if (top < pad) top = anchor.top + anchor.height + gap;
  }

  const maxTop = Math.max(pad, view.height - size.height - pad);
  const maxLeft = Math.max(pad, view.width - size.width - pad);
  return {
    top: Math.min(Math.max(pad, top), maxTop),
    left: Math.min(Math.max(pad, left), maxLeft),
  };
}
