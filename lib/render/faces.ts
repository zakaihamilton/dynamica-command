import type { FaceDna } from "../types";

function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

export type FaceTone = "ally" | "enemy" | "command";

export function drawFace(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  cx: number,
  cy: number,
  size: number,
  time: number,
  talking: boolean,
  tone: FaceTone = "ally",
): void {
  const blink = time % 180 < 8;
  const mouth = talking ? 0.18 + Math.abs(Math.sin(time / 3.6)) * 0.5 : 0.1;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);

  const booth = tone === "enemy" ? "#1a1210" : tone === "command" ? "#12160f" : "#10140c";
  const boothRim = tone === "enemy" ? "#5a2e24" : "#3d4633";
  ctx.fillStyle = booth;
  ctx.fillRect(-56, -72, 112, 148);
  ctx.fillStyle = tone === "enemy"
    ? "rgba(90, 36, 28, 0.28)"
    : "rgba(48, 62, 36, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, -6, 46, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = boothRim;
  ctx.lineWidth = 2;
  ctx.strokeRect(-54, -70, 108, 144);

  ctx.fillStyle = "rgba(8, 10, 8, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 68, 42, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(dna.uniform, -32);
  ctx.beginPath();
  ctx.moveTo(-50, 82);
  ctx.lineTo(-34, 38);
  ctx.lineTo(34, 38);
  ctx.lineTo(50, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dna.uniform;
  ctx.beginPath();
  ctx.moveTo(-28, 42);
  ctx.lineTo(-16, 38);
  ctx.lineTo(16, 38);
  ctx.lineTo(28, 42);
  ctx.lineTo(22, 78);
  ctx.lineTo(-22, 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(dna.uniform, 22);
  ctx.beginPath();
  ctx.moveTo(-16, 38);
  ctx.lineTo(0, 48);
  ctx.lineTo(16, 38);
  ctx.lineTo(10, 70);
  ctx.lineTo(-10, 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(dna.uniform, -40);
  ctx.fillRect(-6, 46, 12, 28);

  const brass = ["#c4a45a", "#b8c5c6", "#9d4b3d", "#708e5b"][dna.insignia]!;
  ctx.fillStyle = brass;
  if (dna.insignia === 0) {
    ctx.fillRect(18, 52, 10, 4);
    ctx.fillRect(18, 58, 10, 4);
  } else if (dna.insignia === 1) {
    ctx.fillRect(-30, 54, 6, 6);
    ctx.fillRect(-22, 54, 6, 6);
  } else if (dna.insignia === 2) {
    ctx.beginPath();
    ctx.moveTo(20, 52);
    ctx.lineTo(30, 58);
    ctx.lineTo(20, 64);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(20, 50, 4, 16);
    ctx.fillRect(16, 54, 12, 3);
  }

  ctx.fillStyle = shade(dna.skin, -36);
  ctx.beginPath();
  ctx.ellipse(0, 40, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dna.skin;
  ctx.beginPath();
  ctx.ellipse(0, 38, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const jw = 33 * dna.jaw;
  ctx.fillStyle = shade(dna.skin, -30);
  ctx.beginPath();
  ctx.ellipse(2, 12, jw, 44, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dna.skin;
  ctx.beginPath();
  ctx.ellipse(0, 6, jw, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(dna.skin, 26);
  ctx.beginPath();
  ctx.ellipse(-9, -2, jw * 0.42, 26, -0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(dna.skin, -20);
  ctx.beginPath();
  ctx.ellipse(-jw + 3, 4, 7, 11, 0.18, 0, Math.PI * 2);
  ctx.ellipse(jw - 3, 4, 7, 11, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(dna.skin, -8);
  ctx.beginPath();
  ctx.ellipse(-jw + 3, 5, 4, 6, 0.18, 0, Math.PI * 2);
  ctx.ellipse(jw - 3, 5, 4, 6, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = dna.hair;
  ctx.beginPath();
  if (dna.hairStyle === 0) {
    ctx.ellipse(0, -28, 36, 18, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-20, -10, 11, 16, 0.35, 0, Math.PI * 2);
    ctx.ellipse(20, -10, 11, 16, -0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (dna.hairStyle === 1) {
    ctx.fillRect(-34, -50, 68, 28);
    ctx.fillRect(-36, -28, 10, 40);
    ctx.fillRect(26, -28, 10, 34);
  } else if (dna.hairStyle === 2) {
    ctx.moveTo(-32, -8);
    ctx.lineTo(-6, -56);
    ctx.lineTo(8, -50);
    ctx.lineTo(32, -8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.ellipse(0, -26, 32, 15, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = shade(dna.hair, 28);
  ctx.beginPath();
  ctx.ellipse(-10, -34, 11, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  if (dna.headgear === 1) {
    ctx.fillStyle = shade(dna.uniform, -18);
    ctx.beginPath();
    ctx.ellipse(0, -32, 38, 15, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-34, -34, 68, 7);
    ctx.fillStyle = brass;
    ctx.fillRect(-4, -38, 8, 4);
  } else if (dna.headgear === 2) {
    ctx.fillStyle = shade(dna.uniform, -10);
    ctx.beginPath();
    ctx.moveTo(-34, -28);
    ctx.lineTo(-10, -50);
    ctx.lineTo(30, -34);
    ctx.lineTo(34, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c1a85b";
    ctx.fillRect(-3, -42, 8, 8);
  } else if (dna.headgear === 3) {
    ctx.fillStyle = "#2a332c";
    ctx.fillRect(-38, -44, 76, 14);
    ctx.fillStyle = "#101814";
    ctx.fillRect(-32, -31, 64, 5);
    ctx.fillStyle = brass;
    ctx.fillRect(-6, -42, 12, 4);
  }

  const browY = -12 - dna.brow * 6;
  ctx.strokeStyle = shade(dna.hair, -20);
  ctx.lineWidth = 3;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(-19, browY);
  ctx.quadraticCurveTo(-11, browY - 3, -5, browY + 1);
  ctx.moveTo(5, browY + 1);
  ctx.quadraticCurveTo(11, browY - 3, 19, browY);
  ctx.stroke();

  if (blink) {
    ctx.strokeStyle = "#1a1010";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, -1);
    ctx.lineTo(-5, 0);
    ctx.moveTo(5, 0);
    ctx.lineTo(17, -1);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#f3efe4";
    ctx.beginPath();
    ctx.ellipse(-11, 0, 8, 5.2, 0.08, 0, Math.PI * 2);
    ctx.ellipse(11, 0, 8, 5.2, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dna.eyes;
    ctx.beginPath();
    ctx.ellipse(-11, 0.6, 3.6, 3.8, 0, 0, Math.PI * 2);
    ctx.ellipse(11, 0.6, 3.6, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath();
    ctx.arc(-11, 0.6, 1.7, 0, Math.PI * 2);
    ctx.arc(11, 0.6, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-9.4, -0.6, 1.15, 0, Math.PI * 2);
    ctx.arc(12.6, -0.6, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = shade(dna.skin, -24);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-3.6 * dna.nose, 17);
  ctx.lineTo(3.6 * dna.nose, 17);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(dna.skin, 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(-1.1 * dna.nose, 15);
  ctx.lineTo(1.7 * dna.nose, 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7a3535";
  ctx.beginPath();
  ctx.ellipse(0, 30, 18 * dna.mouthWidth, 6 * mouth + 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d4a08a";
  ctx.beginPath();
  ctx.ellipse(0, 28.6, 15 * dna.mouthWidth, 2.1, 0, Math.PI, 0);
  ctx.fill();
  if (mouth > 0.22) {
    ctx.fillStyle = "#3a1018";
    ctx.beginPath();
    ctx.ellipse(0, 31, 11 * dna.mouthWidth, 4.2 * mouth, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(-7 * dna.mouthWidth, 29, 14 * dna.mouthWidth, 1.4);
  }

  if (dna.scar) {
    ctx.strokeStyle = shade(dna.skin, -52);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(13, 6);
    ctx.lineTo(21, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, 10);
    ctx.lineTo(18, 11);
    ctx.stroke();
  }

  ctx.restore();
}
