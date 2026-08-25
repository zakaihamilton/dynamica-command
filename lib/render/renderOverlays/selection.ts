export function drawSelectBox(
  ctx: CanvasRenderingContext2D,
  box?: { x0: number; y0: number; x1: number; y1: number } | null,
): void {
  if (!box) return;
  if (Math.hypot(box.x1 - box.x0, box.y1 - box.y0) <= 8) return;
  const x = Math.min(box.x0, box.x1);
  const y = Math.min(box.y0, box.y1);
  const w = Math.abs(box.x1 - box.x0);
  const h = Math.abs(box.y1 - box.y0);
  ctx.save();
  ctx.fillStyle = "rgba(212, 191, 106, 0.12)";
  ctx.strokeStyle = "rgba(245, 230, 168, 0.95)";
  ctx.lineWidth = 1;
  ctx.fillRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();
}
