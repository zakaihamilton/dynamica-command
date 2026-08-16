import type { FaceDna } from "../types";

export type FaceTone = "ally" | "enemy" | "command";

function hexRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  if (n.length !== 6) return [128, 128, 128];
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))})`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  return rgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lite(hex: string, t: number): string {
  return mix(hex, "#fff4e4", t);
}

function deep(hex: string, t: number): string {
  return mix(hex, "#1a100c", t);
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rot = 0,
): void {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = fill;
  ctx.fill();
}

function headPath(ctx: CanvasRenderingContext2D, jw: number, chin: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.bezierCurveTo(jw * 0.42, -41, jw * 0.72, -34, jw * 0.78, -20);
  ctx.bezierCurveTo(jw * 0.86, -8, jw * 0.9, 4, jw * 0.82, 12);
  ctx.lineTo(jw * 0.7, 22);
  ctx.quadraticCurveTo(jw * 0.42, chin - 1, 0, chin);
  ctx.quadraticCurveTo(-jw * 0.42, chin - 1, -jw * 0.7, 22);
  ctx.lineTo(-jw * 0.82, 12);
  ctx.bezierCurveTo(-jw * 0.9, 4, -jw * 0.86, -8, -jw * 0.78, -20);
  ctx.bezierCurveTo(-jw * 0.72, -34, -jw * 0.42, -41, 0, -40);
  ctx.closePath();
}

function eyeAlmond(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.bezierCurveTo(x - rx * 0.45, y - ry, x + rx * 0.4, y - ry * 1.05, x + rx, y);
  ctx.bezierCurveTo(x + rx * 0.42, y + ry, x - rx * 0.48, y + ry * 0.92, x - rx, y);
  ctx.closePath();
}

function paintBooth(ctx: CanvasRenderingContext2D, tone: FaceTone): void {
  const booth = tone === "enemy" ? "#1c1210" : tone === "command" ? "#12160f" : "#10140c";
  const glow = tone === "enemy" ? "rgba(110, 38, 28, 0.34)" : "rgba(52, 72, 38, 0.28)";
  const rim = tone === "enemy" ? "#6a3428" : "#3d4633";
  ctx.fillStyle = booth;
  ctx.fillRect(-58, -74, 116, 152);
  const wash = ctx.createRadialGradient(-8, -18, 8, 0, 4, 70);
  wash.addColorStop(0, glow);
  wash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(-58, -74, 116, 152);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.strokeRect(-55, -71, 110, 146);
  ctx.fillStyle = mix(rim, "#080a08", 0.35);
  for (const [x, y] of [[-52, -68], [48, -68], [-52, 70], [48, 70]]) {
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.fillStyle = "rgba(8, 10, 8, 0.55)";
  ellipse(ctx, 0, 70, 44, 11);
  ctx.fill();
}

function paintTorso(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  tone: FaceTone,
  brass: string,
): void {
  const cloth = dna.uniform;
  const piping = tone === "enemy" ? "#8a4034" : tone === "command" ? "#c4a45a" : lite(cloth, 0.22);
  ctx.fillStyle = deep(cloth, 0.28);
  ctx.beginPath();
  ctx.moveTo(-54, 84);
  ctx.lineTo(-38, 34);
  ctx.lineTo(38, 34);
  ctx.lineTo(54, 84);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-32, 38);
  ctx.lineTo(-12, 34);
  ctx.lineTo(12, 34);
  ctx.lineTo(32, 38);
  ctx.lineTo(26, 82);
  ctx.lineTo(-26, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lite(cloth, 0.18);
  ctx.beginPath();
  ctx.moveTo(-14, 36);
  ctx.lineTo(0, 48);
  ctx.lineTo(14, 36);
  ctx.lineTo(10, 78);
  ctx.lineTo(-10, 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deep(cloth, 0.42);
  ctx.fillRect(-5, 46, 10, 30);
  ctx.fillStyle = piping;
  ctx.fillRect(-26, 40, 3, 36);
  ctx.fillRect(23, 40, 3, 36);
  ctx.fillStyle = brass;
  if (dna.insignia === 0) {
    ctx.fillRect(16, 52, 12, 3);
    ctx.fillRect(16, 58, 12, 3);
    ctx.fillRect(16, 64, 12, 3);
  } else if (dna.insignia === 1) {
    fillEllipse(ctx, -22, 58, 4, 4, brass);
    fillEllipse(ctx, -14, 58, 4, 4, brass);
  } else if (dna.insignia === 2) {
    ctx.beginPath();
    ctx.moveTo(18, 50);
    ctx.lineTo(30, 58);
    ctx.lineTo(18, 66);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(20, 50, 4, 18);
    ctx.fillRect(16, 56, 12, 3);
  }
  if (tone === "command") {
    ctx.fillStyle = brass;
    ctx.fillRect(-30, 42, 14, 3);
    ctx.fillRect(16, 42, 14, 3);
  }
}

function paintNeck(ctx: CanvasRenderingContext2D, skin: string): void {
  ctx.fillStyle = deep(skin, 0.28);
  ctx.beginPath();
  ctx.moveTo(-13, 30);
  ctx.lineTo(13, 30);
  ctx.lineTo(16, 48);
  ctx.lineTo(-16, 48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-11, 30);
  ctx.lineTo(11, 30);
  ctx.lineTo(13, 46);
  ctx.lineTo(-13, 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lite(skin, 0.16);
  ctx.fillRect(-4, 32, 5, 12);
  fillEllipse(ctx, 0, 40, 3.2, 2.2, deep(skin, 0.18));
}

function paintCollar(ctx: CanvasRenderingContext2D, cloth: string, brass: string): void {
  ctx.fillStyle = deep(cloth, 0.12);
  ctx.beginPath();
  ctx.moveTo(-22, 36);
  ctx.lineTo(-8, 30);
  ctx.lineTo(0, 42);
  ctx.lineTo(-18, 52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, 36);
  ctx.lineTo(8, 30);
  ctx.lineTo(0, 42);
  ctx.lineTo(18, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lite(cloth, 0.2);
  ctx.beginPath();
  ctx.moveTo(-18, 36);
  ctx.lineTo(-8, 32);
  ctx.lineTo(0, 40);
  ctx.lineTo(-16, 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = brass;
  fillEllipse(ctx, -14, 40, 2.2, 2.2, brass);
  fillEllipse(ctx, 14, 40, 2.2, 2.2, brass);
}

function paintEar(ctx: CanvasRenderingContext2D, x: number, skin: string, flip: number): void {
  ctx.save();
  ctx.translate(x, 2);
  ctx.scale(flip, 1);
  ctx.fillStyle = deep(skin, 0.2);
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.bezierCurveTo(6, -6, 7, 2, 2, 10);
  ctx.quadraticCurveTo(-0.5, 8, 0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.4, -5.5);
  ctx.bezierCurveTo(4.8, -4.5, 5.4, 2, 1.6, 8);
  ctx.quadraticCurveTo(0.2, 6, 0.6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = deep(skin, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1.6, -2);
  ctx.quadraticCurveTo(4, 1, 1.4, 5.5);
  ctx.stroke();
  ctx.restore();
}

function paintHair(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  jw: number,
  layer: "back" | "front",
): void {
  const hair = dna.hair;
  const shine = lite(hair, 0.22);
  const shade = deep(hair, 0.18);
  const capped = dna.headgear !== 0;
  if (layer === "back") {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(-jw * 0.7, -8);
    ctx.quadraticCurveTo(-jw - 4, 4, -jw * 0.55, 16);
    ctx.lineTo(-jw * 0.4, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(jw * 0.7, -8);
    ctx.quadraticCurveTo(jw + 4, 4, jw * 0.55, 16);
    ctx.lineTo(jw * 0.4, 8);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (capped && dna.headgear === 3) return;
  const hairline = dna.hairStyle === 3 ? -26 : dna.hairStyle === 1 ? -14 : -18;
  ctx.fillStyle = hair;
  if (dna.hairStyle === 3) return;
  if (capped) {
    ctx.beginPath();
    ctx.moveTo(-jw * 0.82, -12);
    ctx.quadraticCurveTo(-jw * 0.7, -20, -jw * 0.4, -18);
    ctx.lineTo(-jw * 0.55, -12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(jw * 0.82, -12);
    ctx.quadraticCurveTo(jw * 0.7, -20, jw * 0.4, -18);
    ctx.lineTo(jw * 0.55, -12);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  if (dna.hairStyle === 0) {
    ctx.moveTo(-jw * 0.78, -12);
    ctx.bezierCurveTo(-jw * 0.9, -28, -jw * 0.4, -44, 0, -43);
    ctx.bezierCurveTo(jw * 0.4, -44, jw * 0.9, -28, jw * 0.78, -12);
    ctx.quadraticCurveTo(jw * 0.2, hairline - 2, 0, hairline);
    ctx.quadraticCurveTo(-jw * 0.2, hairline - 2, -jw * 0.78, -12);
    ctx.fill();
    ctx.strokeStyle = shine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -34);
    ctx.quadraticCurveTo(0, -40, 12, -32);
    ctx.stroke();
  } else if (dna.hairStyle === 1) {
    ctx.moveTo(-jw * 0.85, -8);
    ctx.bezierCurveTo(-jw * 0.95, -32, -jw * 0.3, -48, 4, -46);
    ctx.bezierCurveTo(jw * 0.55, -48, jw, -30, jw * 0.88, -6);
    ctx.lineTo(jw * 0.55, 4);
    ctx.quadraticCurveTo(10, -16, -4, hairline);
    ctx.quadraticCurveTo(-jw * 0.35, -10, -jw * 0.7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-2, -38);
    ctx.quadraticCurveTo(10, -42, 16, -28);
    ctx.strokeStyle = shine;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-2, -18);
    ctx.quadraticCurveTo(8, -20, 14, -12);
    ctx.stroke();
  } else {
    ctx.moveTo(-jw * 0.72, -10);
    ctx.bezierCurveTo(-jw * 0.6, -36, -8, -48, 0, -42);
    ctx.bezierCurveTo(10, -50, jw * 0.65, -36, jw * 0.72, -10);
    ctx.quadraticCurveTo(8, -20, 0, -16);
    ctx.quadraticCurveTo(-8, -20, -jw * 0.72, -10);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(-6, hairline);
    ctx.lineTo(0, -12);
    ctx.lineTo(6, hairline);
    ctx.quadraticCurveTo(0, hairline + 3, -6, hairline);
    ctx.fill();
    ctx.strokeStyle = shine;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-8, -34);
    ctx.quadraticCurveTo(2, -40, 10, -30);
    ctx.stroke();
  }
}

function paintHeadgear(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  brass: string,
  jw: number,
): void {
  const cloth = dna.uniform;
  if (dna.headgear === 1) {
    ctx.fillStyle = deep(cloth, 0.18);
    ctx.beginPath();
    ctx.moveTo(-jw * 0.92, -22);
    ctx.lineTo(-jw * 0.7, -44);
    ctx.lineTo(jw * 0.62, -43);
    ctx.lineTo(jw * 0.95, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(-jw * 0.88, -24);
    ctx.lineTo(-jw * 0.66, -40);
    ctx.lineTo(jw * 0.58, -39);
    ctx.lineTo(jw * 0.9, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = deep(cloth, 0.35);
    ctx.beginPath();
    ctx.moveTo(-jw * 0.98, -22);
    ctx.lineTo(jw * 1.02, -22);
    ctx.lineTo(jw * 0.9, -18);
    ctx.lineTo(-jw * 0.86, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = brass;
    ctx.fillRect(-4, -36, 8, 4);
  } else if (dna.headgear === 2) {
    ctx.fillStyle = deep(cloth, 0.22);
    ctx.beginPath();
    ctx.moveTo(-jw * 0.9, -22);
    ctx.bezierCurveTo(-jw * 0.7, -50, 18, -54, jw * 1.05, -24);
    ctx.quadraticCurveTo(jw * 0.4, -20, -jw * 0.9, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(-jw * 0.82, -24);
    ctx.bezierCurveTo(-jw * 0.5, -46, 16, -50, jw * 0.92, -24);
    ctx.quadraticCurveTo(10, -22, -jw * 0.82, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = deep(cloth, 0.4);
    ctx.fillRect(-jw * 0.72, -26, jw * 1.44, 5);
    ctx.fillStyle = brass;
    fillEllipse(ctx, -6, -34, 3.2, 3.2, brass);
  } else if (dna.headgear === 3) {
    ctx.fillStyle = deep(cloth, 0.22);
    ctx.beginPath();
    ctx.moveTo(-jw * 0.95, -22);
    ctx.bezierCurveTo(-jw * 0.8, -48, jw * 0.8, -48, jw * 0.95, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(cloth, "#2a332c", 0.35);
    ctx.beginPath();
    ctx.moveTo(-jw * 0.88, -24);
    ctx.bezierCurveTo(-jw * 0.7, -44, jw * 0.7, -44, jw * 0.88, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#101814";
    ctx.fillRect(-jw * 0.92, -24, jw * 1.84, 6);
    ctx.fillStyle = brass;
    ctx.fillRect(-6, -38, 12, 3);
    ctx.fillStyle = "rgba(8, 12, 8, 0.28)";
    ctx.beginPath();
    ctx.moveTo(-jw * 0.7, -18);
    ctx.lineTo(jw * 0.7, -18);
    ctx.lineTo(jw * 0.55, -12);
    ctx.lineTo(-jw * 0.55, -12);
    ctx.closePath();
    ctx.fill();
  }
}

function paintHeadset(ctx: CanvasRenderingContext2D, jw: number, band: boolean): void {
  if (band) {
    ctx.strokeStyle = "#2a322c";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -6, jw + 3, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
  fillEllipse(ctx, -jw * 0.92, 2, 4.5, 6.2, "#2c342e", 0.12);
  fillEllipse(ctx, -jw * 0.92, 2, 2.6, 3.8, "#1a201c", 0.12);
  ctx.strokeStyle = "#3a423c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-jw * 0.92, 7);
  ctx.quadraticCurveTo(-16, 18, -6, 22);
  ctx.stroke();
  fillEllipse(ctx, -5.5, 22, 2.1, 1.7, "#c4a45a");
}

function paintBeard(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  jw: number,
  chin: number,
  mouthY: number,
): void {
  if (dna.beard === 0) return;
  const hair = dna.hair;
  if (dna.beard === 1) {
    ctx.fillStyle = mix(hair, dna.skin, 0.55);
    for (let i = 0; i < 28; i++) {
      const x = ((i * 37) % 31) - 15;
      const y = mouthY + 6 + ((i * 17) % 12);
      if (Math.abs(x) > jw * 0.72) continue;
      fillEllipse(ctx, x * 0.9, y, 1.1, 1.4, mix(hair, dna.skin, 0.55));
    }
    return;
  }
  if (dna.beard === 2) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-5, mouthY + 6);
    ctx.quadraticCurveTo(0, chin + 6, 5, mouthY + 6);
    ctx.quadraticCurveTo(0, mouthY + 8, -5, mouthY + 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, mouthY - 2);
    ctx.quadraticCurveTo(0, mouthY + 4, 7, mouthY - 2);
    ctx.quadraticCurveTo(0, mouthY, -7, mouthY - 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-jw * 0.78, 8);
  ctx.quadraticCurveTo(-jw * 0.9, 22, -jw * 0.45, chin + 2);
  ctx.quadraticCurveTo(0, chin + 8, jw * 0.45, chin + 2);
  ctx.quadraticCurveTo(jw * 0.9, 22, jw * 0.78, 8);
  ctx.quadraticCurveTo(jw * 0.4, 18, 0, 16);
  ctx.quadraticCurveTo(-jw * 0.4, 18, -jw * 0.78, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-9, mouthY - 4);
  ctx.quadraticCurveTo(0, mouthY + 3, 9, mouthY - 4);
  ctx.quadraticCurveTo(0, mouthY - 1, -9, mouthY - 4);
  ctx.fill();
  ctx.fillStyle = lite(hair, 0.16);
  fillEllipse(ctx, -6, 22, 4, 6, lite(hair, 0.16), 0.2);
}

function paintEyes(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  blink: boolean,
  look: number,
  browY: number,
  tone: FaceTone,
): void {
  const lx = -11 + look * 0.4;
  const rx = 11 + look * 0.4;
  const y = -2;
  const drop = tone === "enemy" ? 2.4 : tone === "command" ? 1.1 : 0.2;
  ctx.fillStyle = deep(dna.hair, 0.04);
  ctx.beginPath();
  ctx.moveTo(lx - 8, browY + 0.6 + drop * 0.15);
  ctx.quadraticCurveTo(lx, browY - 1.6 - dna.brow * 1.2, lx + 7.2, browY + 1.2 + drop);
  ctx.lineTo(lx + 6.6, browY + 2.2 + drop);
  ctx.quadraticCurveTo(lx, browY + 0.2 - dna.brow * 0.6, lx - 7.4, browY + 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx - 7.2, browY + 1.2 + drop);
  ctx.quadraticCurveTo(rx, browY - 1.6 - dna.brow * 1.2, rx + 8, browY + 0.6 + drop * 0.15);
  ctx.lineTo(rx + 7.4, browY + 1.6);
  ctx.quadraticCurveTo(rx, browY + 0.2 - dna.brow * 0.6, rx - 6.6, browY + 2.2 + drop);
  ctx.closePath();
  ctx.fill();
  if (blink) {
    ctx.strokeStyle = deep(dna.skin, 0.4);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx - 7, y);
    ctx.quadraticCurveTo(lx, y + 1, lx + 7, y);
    ctx.moveTo(rx - 7, y);
    ctx.quadraticCurveTo(rx, y + 1, rx + 7, y);
    ctx.stroke();
    return;
  }
  for (const x of [lx, rx]) {
    ctx.fillStyle = deep(dna.skin, 0.1);
    eyeAlmond(ctx, x, y + 0.8, 7.4, 3.2);
    ctx.fill();
    ctx.fillStyle = "#efeae0";
    eyeAlmond(ctx, x, y, 7.2, 3.4);
    ctx.fill();
    ctx.save();
    eyeAlmond(ctx, x, y, 7.2, 3.4);
    ctx.clip();
    const ix = x + look * 1.4;
    fillEllipse(ctx, ix, y + 0.5, 3.3, 3.6, dna.eyes);
    fillEllipse(ctx, ix, y + 0.7, 1.7, 1.9, "#0c0c0c");
    fillEllipse(ctx, ix - 0.9, y - 0.5, 0.95, 0.95, "#fff");
    ctx.fillStyle = deep(dna.skin, 0.38);
    ctx.beginPath();
    ctx.moveTo(x - 7.2, y - 0.4);
    ctx.quadraticCurveTo(x, y - 3.8, x + 7.2, y - 0.4);
    ctx.quadraticCurveTo(x, y - 1.2, x - 7.2, y - 0.4);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = deep(dna.skin, 0.4);
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.quadraticCurveTo(x, y - 3.6, x + 7, y);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 6.2, y + 1.8);
    ctx.quadraticCurveTo(x, y + 3.1, x + 6.2, y + 1.8);
    ctx.stroke();
  }
}

function paintNose(ctx: CanvasRenderingContext2D, dna: FaceDna, look: number): void {
  const w = 3.4 * dna.nose;
  ctx.fillStyle = deep(dna.skin, 0.18);
  ctx.beginPath();
  ctx.moveTo(-1.2 + look * 0.4, 2);
  ctx.quadraticCurveTo(-w * 0.55, 11, -w * 0.95, 16);
  ctx.quadraticCurveTo(look * 0.2, 19.2, w * 0.9 + look, 16);
  ctx.quadraticCurveTo(w * 0.35, 11, 0.6 + look * 0.4, 2);
  ctx.fill();
  ctx.fillStyle = lite(dna.skin, 0.16);
  ctx.beginPath();
  ctx.moveTo(-0.2 + look * 0.2, 3);
  ctx.quadraticCurveTo(-1.4, 11, -0.6, 15);
  ctx.quadraticCurveTo(1.6 + look, 14.6, 0.8 + look * 0.3, 3);
  ctx.fill();
  fillEllipse(ctx, look * 0.25, 16.8, w * 1.05, 3.1, mix(dna.skin, deep(dna.skin, 0.12), 0.35));
  fillEllipse(ctx, -w * 0.72, 16.8, 2, 1.35, deep(dna.skin, 0.28), 0.25);
  fillEllipse(ctx, w * 0.78 + look, 16.8, 2, 1.35, deep(dna.skin, 0.2), -0.25);
  fillEllipse(ctx, -0.6, 13.5, 1.3, 2.2, lite(dna.skin, 0.2));
}

function paintMouth(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  mouth: number,
  talking: boolean,
): void {
  const y = 24;
  const w = 13.5 * dna.mouthWidth;
  const open = talking ? mouth : 0.06;
  ctx.fillStyle = "#6e3434";
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(0, y + 2 + open * 8, w, y);
  ctx.quadraticCurveTo(0, y - 1.4, -w, y);
  ctx.fill();
  if (talking && open > 0.18) {
    ctx.fillStyle = "#3a1018";
    ctx.beginPath();
    ctx.moveTo(-w * 0.72, y + 0.4);
    ctx.quadraticCurveTo(0, y + 1.6 + open * 6.5, w * 0.72, y + 0.4);
    ctx.quadraticCurveTo(0, y + 0.2, -w * 0.72, y + 0.4);
    ctx.fill();
    ctx.fillStyle = "#e6d8c4";
    ctx.beginPath();
    ctx.moveTo(-w * 0.58, y);
    ctx.lineTo(w * 0.58, y);
    ctx.lineTo(w * 0.5, y + 1.5);
    ctx.lineTo(-w * 0.5, y + 1.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = mix("#a35a54", dna.skin, 0.32);
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(-w * 0.35, y - 2.8, 0, y - 1.1);
  ctx.quadraticCurveTo(w * 0.35, y - 2.8, w, y);
  ctx.quadraticCurveTo(0, y + 0.8, -w, y);
  ctx.fill();
  if (!talking || open < 0.2) {
    ctx.fillStyle = mix("#c4786a", dna.skin, 0.22);
    ctx.beginPath();
    ctx.moveTo(-w * 0.88, y + 0.4);
    ctx.quadraticCurveTo(0, y + 3.4, w * 0.88, y + 0.4);
    ctx.quadraticCurveTo(0, y + 1.2, -w * 0.88, y + 0.4);
    ctx.fill();
  }
  ctx.strokeStyle = deep(dna.skin, 0.22);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-1.8, 19);
  ctx.lineTo(-0.8, 22.4);
  ctx.moveTo(1.8, 19);
  ctx.lineTo(0.8, 22.4);
  ctx.stroke();
}

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
  const mouth = talking ? 0.16 + Math.abs(Math.sin(time / 3.6)) * 0.52 : 0.08;
  const look = tone === "enemy" ? -1 : 1;
  const jw = 26 + dna.jaw * 10;
  const chin = 34 + (dna.jaw - 1) * 3;
  const brass = ["#c4a45a", "#b8c5c6", "#9d4b3d", "#708e5b"][dna.insignia]!;
  const browY = -8 - dna.brow * 3;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  ctx.translate(cx, cy + (talking ? Math.sin(time / 4.2) * 0.7 : 0));
  ctx.scale(size / 100, size / 100);
  ctx.rotate(look * 0.04);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  paintBooth(ctx, tone);
  paintTorso(ctx, dna, tone, brass);
  paintNeck(ctx, dna.skin);
  paintHair(ctx, dna, jw, "back");
  paintEar(ctx, -jw * 0.82, dna.skin, -1);
  paintEar(ctx, jw * 0.82, dna.skin, 1);
  headPath(ctx, jw, chin);
  ctx.fillStyle = dna.skin;
  ctx.fill();
  headPath(ctx, jw, chin);
  ctx.strokeStyle = deep(dna.skin, 0.32);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.save();
  headPath(ctx, jw, chin);
  ctx.clip();
  const light = ctx.createRadialGradient(-16, -20, 4, -2, 4, 56);
  light.addColorStop(0, lite(dna.skin, 0.12));
  light.addColorStop(0.5, "rgba(0,0,0,0)");
  light.addColorStop(1, deep(dna.skin, 0.14));
  ctx.fillStyle = light;
  ctx.fillRect(-jw - 4, -46, jw * 2 + 8, chin + 50);
  paintEyes(ctx, dna, blink, look, browY, tone);
  paintNose(ctx, dna, look);
  paintMouth(ctx, dna, mouth, talking);
  if (dna.scar) {
    ctx.strokeStyle = deep(dna.skin, 0.42);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(20, 18);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, 4);
    ctx.lineTo(16, 5);
    ctx.moveTo(16, 10);
    ctx.lineTo(19, 11);
    ctx.stroke();
  }
  paintBeard(ctx, dna, jw, chin, 24);
  ctx.restore();

  paintHair(ctx, dna, jw, "front");
  paintHeadgear(ctx, dna, brass, jw);
  if (tone === "ally" && dna.headgear !== 3) paintHeadset(ctx, jw, dna.headgear === 0);
  paintCollar(ctx, dna.uniform, brass);
  ctx.fillStyle = "rgba(220, 230, 200, 0.04)";
  ctx.beginPath();
  ctx.moveTo(-48, -68);
  ctx.lineTo(20, -68);
  ctx.lineTo(48, 20);
  ctx.lineTo(-20, 72);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
