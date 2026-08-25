export function healthMeterColors(ratio: number): { top: string; bottom: string } {
  if (ratio > 0.5) {
    return { top: "#4ade80", bottom: "#16a34a" };
  }
  if (ratio > 0.25) {
    return { top: "#fde047", bottom: "#d97706" };
  }
  return { top: "#f87171", bottom: "#dc2626" };
}

export function drawUnitHealthMeter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  hp: number,
  maxHp: number,
  z: number,
  alpha = 1,
  isSelected = false,
  barWidth?: number,
): void {
  if (maxHp <= 0 || hp <= 0) return;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const w = barWidth ?? Math.max(16, Math.round(20 * z));
  const h = Math.max(3, Math.round(3.5 * z));
  const x = Math.round(centerX - w / 2);
  const y = Math.round(topY);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(8, 12, 14, 0.9)";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

  ctx.strokeStyle = isSelected ? "rgba(245, 230, 168, 0.95)" : "rgba(30, 38, 44, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

  ctx.fillStyle = "rgba(18, 22, 26, 0.95)";
  ctx.fillRect(x, y, w, h);

  const fillW = Math.max(0, Math.min(w, Math.round(w * ratio)));
  if (fillW > 0) {
    const { top, bottom } = healthMeterColors(ratio);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, fillW, h);

    if (h >= 3) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x, y, fillW, 1);
    }
  }

  if (isSelected) {
    ctx.fillStyle = "#f5e6a8";
    ctx.fillRect(x, y - 2, w, 1);
  }

  ctx.restore();
}
