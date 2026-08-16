import type { FaceDna } from "../types";

function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

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

  ctx.fillStyle = "#1a140c";
  ctx.beginPath();
  ctx.ellipse(0, 70, 48, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(dna.skin, -40);
  ctx.beginPath();
  ctx.ellipse(0, 52, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2a2418";
  ctx.beginPath();
  ctx.moveTo(-46, 78);
  ctx.lineTo(-28, 48);
  ctx.lineTo(28, 48);
  ctx.lineTo(46, 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a3224";
  ctx.fillRect(-18, 48, 36, 10);

  const jw = 34 * dna.jaw;
  ctx.fillStyle = shade(dna.skin, -28);
  ctx.beginPath();
  ctx.ellipse(2, 14, jw, 46, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dna.skin;
  ctx.beginPath();
  ctx.ellipse(0, 8, jw, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(dna.skin, 28);
  ctx.beginPath();
  ctx.ellipse(-8, 0, jw * 0.45, 28, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(dna.skin, -18);
  ctx.beginPath();
  ctx.ellipse(-jw + 4, 6, 7, 11, 0.2, 0, Math.PI * 2);
  ctx.ellipse(jw - 4, 6, 7, 11, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = dna.hair;
  ctx.beginPath();
  if (dna.hairStyle === 0) {
    ctx.ellipse(0, -26, 38, 20, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-22, -8, 12, 18, 0.4, 0, Math.PI * 2);
    ctx.ellipse(22, -8, 12, 18, -0.4, 0, Math.PI * 2);
  } else if (dna.hairStyle === 1) {
    ctx.rect(-36, -52, 72, 30);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-38, -28, 10, 44);
    ctx.rect(28, -28, 10, 36);
  } else if (dna.hairStyle === 2) {
    ctx.moveTo(-34, -6);
    ctx.lineTo(-8, -58);
    ctx.lineTo(8, -52);
    ctx.lineTo(34, -6);
    ctx.closePath();
  } else {
    ctx.ellipse(0, -24, 34, 16, 0, Math.PI, 0);
  }
  ctx.fill();
  ctx.fillStyle = shade(dna.hair, 30);
  ctx.beginPath();
  ctx.ellipse(-10, -32, 12, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();

  const browY = -10 - dna.brow * 6;
  ctx.strokeStyle = "#1a1010";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, browY);
  ctx.quadraticCurveTo(-12, browY - 3, -6, browY + 1);
  ctx.moveTo(6, browY + 1);
  ctx.quadraticCurveTo(12, browY - 3, 20, browY);
  ctx.stroke();

  if (blink) {
    ctx.strokeStyle = "#1a1010";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-6, 1);
    ctx.moveTo(6, 1);
    ctx.lineTo(18, 0);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.ellipse(-12, 1, 8, 5.5, 0.1, 0, Math.PI * 2);
    ctx.ellipse(12, 1, 8, 5.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dna.eyes;
    ctx.beginPath();
    ctx.ellipse(-12, 1.5, 3.4, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(12, 1.5, 3.4, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath();
    ctx.arc(-12, 1.5, 1.6, 0, Math.PI * 2);
    ctx.arc(12, 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-10.5, 0.2, 1.1, 0, Math.PI * 2);
    ctx.arc(13.5, 0.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = shade(dna.skin, -22);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-3.5 * dna.nose, 18);
  ctx.lineTo(3.5 * dna.nose, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(dna.skin, 18);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(-1.2 * dna.nose, 16);
  ctx.lineTo(1.6 * dna.nose, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#a34a4a";
  ctx.beginPath();
  ctx.ellipse(0, 32, 20 * dna.mouthWidth, 7 * mouth + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c96";
  ctx.beginPath();
  ctx.ellipse(0, 30.5, 16 * dna.mouthWidth, 2.2, 0, Math.PI, 0);
  ctx.fill();
  if (mouth > 0.25) {
    ctx.fillStyle = "#3a1018";
    ctx.beginPath();
    ctx.ellipse(0, 33, 12 * dna.mouthWidth, 4.5 * mouth, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
