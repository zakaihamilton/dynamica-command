import type { FaceDna } from "../types";

export function drawFace(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  cx: number,
  cy: number,
  size: number,
  time: number,
  talking: boolean,
): void {
  const blink = time % 180 < 8;
  const mouth = talking ? 0.15 + Math.abs(Math.sin(time / 4)) * 0.55 : 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);

  ctx.fillStyle = dna.skin;
  ctx.beginPath();
  ctx.ellipse(0, 8, 38 * dna.jaw, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = dna.hair;
  ctx.beginPath();
  if (dna.hairStyle === 0) {
    ctx.ellipse(0, -28, 40, 22, 0, 0, Math.PI * 2);
  } else if (dna.hairStyle === 1) {
    ctx.rect(-40, -50, 80, 28);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-42, -30, 12, 40);
  } else if (dna.hairStyle === 2) {
    ctx.moveTo(-36, -10);
    ctx.lineTo(0, -55);
    ctx.lineTo(36, -10);
    ctx.closePath();
  } else {
    ctx.ellipse(0, -22, 36, 18, 0, Math.PI, 0);
  }
  ctx.fill();

  ctx.fillStyle = "#1a1010";
  ctx.fillRect(-18, -8 - dna.brow * 6, 12, 3);
  ctx.fillRect(6, -8 - dna.brow * 6, 12, 3);

  if (blink) {
    ctx.strokeStyle = "#1a1010";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-12, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(12, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dna.eyes;
    ctx.beginPath();
    ctx.arc(-12, 0, 3, 0, Math.PI * 2);
    ctx.arc(12, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#c48";
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-4 * dna.nose, 18);
  ctx.lineTo(4 * dna.nose, 18);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fill();

  ctx.fillStyle = "#7a3030";
  ctx.beginPath();
  ctx.ellipse(0, 32, 22 * dna.mouthWidth, 8 * mouth + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (mouth > 0.25) {
    ctx.fillStyle = "#3a1018";
    ctx.beginPath();
    ctx.ellipse(0, 33, 14 * dna.mouthWidth, 5 * mouth, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
