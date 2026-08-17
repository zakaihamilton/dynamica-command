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
  if (dna.uniformStyle === 0) {
    ctx.fillRect(-26, 40, 3, 36);
    ctx.fillRect(23, 40, 3, 36);
  } else if (dna.uniformStyle === 1) {
    ctx.fillRect(-30, 43, 60, 3);
    ctx.fillRect(-4, 46, 8, 30);
  } else {
    ctx.beginPath();
    ctx.moveTo(-28, 44);
    ctx.lineTo(-4, 54);
    ctx.lineTo(28, 44);
    ctx.lineTo(26, 49);
    ctx.lineTo(-4, 60);
    ctx.lineTo(-28, 49);
    ctx.closePath();
    ctx.fill();
  }
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
    if (dna.hairStyle === 5 || dna.hairStyle === 4) {
      ctx.beginPath();
      ctx.moveTo(-jw * 0.72, -6);
      ctx.quadraticCurveTo(-jw - 8, 10, -jw * 0.4, 28);
      ctx.lineTo(-jw * 0.2, 18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(jw * 0.72, -6);
      ctx.quadraticCurveTo(jw + 8, 10, jw * 0.4, 28);
      ctx.lineTo(jw * 0.2, 18);
      ctx.closePath();
      ctx.fill();
    } else {
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
    }
    return;
  }
  if (capped && dna.headgear === 3 && dna.hairStyle !== 5 && dna.hairStyle !== 4) return;
  const hairline = dna.hairStyle === 3 ? -26 : dna.hairStyle === 1 ? -14 : dna.hairStyle === 5 ? -12 : -18;
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
    if (dna.hairStyle === 4) {
      fillEllipse(ctx, 10, -28, 7, 6, hair);
      fillEllipse(ctx, 10, -28, 4.5, 3.8, shine);
    }
    if (dna.hairStyle === 5) {
      ctx.beginPath();
      ctx.moveTo(-jw * 0.78, -8);
      ctx.quadraticCurveTo(-jw * 0.95, 12, -jw * 0.45, 24);
      ctx.quadraticCurveTo(-jw * 0.55, 6, -jw * 0.6, -6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(jw * 0.78, -8);
      ctx.quadraticCurveTo(jw * 0.95, 12, jw * 0.45, 24);
      ctx.quadraticCurveTo(jw * 0.55, 6, jw * 0.6, -6);
      ctx.fill();
    }
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
  } else if (dna.hairStyle === 4) {
    ctx.moveTo(-jw * 0.78, -10);
    ctx.bezierCurveTo(-jw * 0.7, -36, -10, -46, 0, -44);
    ctx.bezierCurveTo(12, -46, jw * 0.72, -36, jw * 0.78, -10);
    ctx.quadraticCurveTo(jw * 0.2, -20, 0, -16);
    ctx.quadraticCurveTo(-jw * 0.2, -20, -jw * 0.78, -10);
    ctx.fill();
    fillEllipse(ctx, 11, -30, 8.5, 7.2, hair);
    fillEllipse(ctx, 11, -30, 5.5, 4.4, shine);
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(4, -26);
    ctx.quadraticCurveTo(10, -22, 14, -28);
    ctx.stroke();
  } else if (dna.hairStyle === 5) {
    ctx.moveTo(-jw * 0.88, -8);
    ctx.bezierCurveTo(-jw * 0.95, -34, -jw * 0.2, -48, 2, -46);
    ctx.bezierCurveTo(jw * 0.5, -50, jw * 1.02, -30, jw * 0.9, 2);
    ctx.quadraticCurveTo(jw * 0.7, 22, jw * 0.35, 26);
    ctx.quadraticCurveTo(jw * 0.55, 4, jw * 0.4, hairline);
    ctx.quadraticCurveTo(-6, -18, -jw * 0.55, 8);
    ctx.quadraticCurveTo(-jw * 0.85, 18, -jw * 0.7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.quadraticCurveTo(4, -40, 14, -28);
    ctx.strokeStyle = shine;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-8, hairline + 2);
    ctx.quadraticCurveTo(2, hairline + 8, 12, hairline);
    ctx.quadraticCurveTo(4, hairline + 2, -8, hairline + 2);
    ctx.fill();
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
  if (!capped && dna.hairTexture > 0) {
    ctx.strokeStyle = dna.hairTexture === 2 ? lite(hair, 0.32) : shine;
    ctx.lineWidth = dna.hairTexture === 2 ? 0.9 : 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 6 - 2, -38 + Math.abs(i) * 2);
      ctx.quadraticCurveTo(i * 5 + (dna.hairTexture === 2 ? 4 : 1), -30, i * 6, -20 + Math.abs(i));
      ctx.stroke();
    }
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
  } else if (dna.headgear === 4) {
    ctx.fillStyle = deep(cloth, 0.18);
    ctx.beginPath();
    ctx.ellipse(-4, -30, jw * 0.78, 16, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.ellipse(-4, -31, jw * 0.7, 13.5, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = deep(cloth, 0.4);
    ctx.beginPath();
    ctx.ellipse(-4, -24, jw * 0.62, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = brass;
    fillEllipse(ctx, jw * 0.42, -28, 2.6, 2.6, brass);
    ctx.fillStyle = lite(cloth, 0.16);
    ctx.beginPath();
    ctx.ellipse(-14, -36, 10, 4, -0.5, 0, Math.PI * 2);
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
  const s = dna.eyeSize;
  const gap = 10.2 + (1.2 - s) * 2.4;
  const lx = -gap + look * 0.4;
  const rx = gap + look * 0.4;
  const y = dna.eyeShape === 2 ? -1.2 : -2;
  const drop = tone === "enemy" ? 2.4 : tone === "command" ? 1.1 : 0.2;
  const rxEye = (dna.eyeShape === 1 ? 6.4 : 7.3) * s;
  const ryEye = (dna.eyeShape === 1 ? 4.5 : dna.eyeShape === 2 ? 2.35 : 3.45) * s;
  const browW = rxEye + 0.8;
  ctx.fillStyle = deep(dna.hair, dna.feminine ? 0.08 : 0.02);
  ctx.beginPath();
  ctx.moveTo(lx - browW, browY + 0.6 + drop * 0.15);
  ctx.quadraticCurveTo(lx, browY - 1.4 - dna.brow * (dna.feminine ? 1.8 : 1.1), lx + browW - 0.6, browY + 1.2 + drop);
  ctx.lineTo(lx + browW - 1, browY + 2.4 + drop);
  ctx.quadraticCurveTo(lx, browY + 0.3 - dna.brow * 0.5, lx - browW + 0.6, browY + 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx - browW + 0.6, browY + 1.2 + drop);
  ctx.quadraticCurveTo(rx, browY - 1.4 - dna.brow * (dna.feminine ? 1.8 : 1.1), rx + browW, browY + 0.6 + drop * 0.15);
  ctx.lineTo(rx + browW - 0.6, browY + 1.6);
  ctx.quadraticCurveTo(rx, browY + 0.3 - dna.brow * 0.5, rx - browW + 1, browY + 2.4 + drop);
  ctx.closePath();
  ctx.fill();
  if (blink) {
    ctx.strokeStyle = deep(dna.skin, 0.4);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx - rxEye, y);
    ctx.quadraticCurveTo(lx, y + 1, lx + rxEye, y);
    ctx.moveTo(rx - rxEye, y);
    ctx.quadraticCurveTo(rx, y + 1, rx + rxEye, y);
    ctx.stroke();
    return;
  }
  for (const x of [lx, rx]) {
    ctx.fillStyle = deep(dna.skin, 0.1);
    if (dna.eyeShape === 1) fillEllipse(ctx, x, y + 0.6, rxEye, ryEye * 0.92, deep(dna.skin, 0.1));
    else {
      eyeAlmond(ctx, x, y + 0.7, rxEye, ryEye * 0.92);
      ctx.fill();
    }
    ctx.fillStyle = "#efeae0";
    if (dna.eyeShape === 1) fillEllipse(ctx, x, y, rxEye, ryEye, "#efeae0");
    else {
      eyeAlmond(ctx, x, y, rxEye, ryEye);
      ctx.fill();
    }
    ctx.save();
    if (dna.eyeShape === 1) {
      ellipse(ctx, x, y, rxEye, ryEye);
      ctx.clip();
    } else {
      eyeAlmond(ctx, x, y, rxEye, ryEye);
      ctx.clip();
    }
    const ix = x + look * 1.4;
    const iris = 2.7 * s * (dna.eyeShape === 2 ? 0.85 : 1);
    fillEllipse(ctx, ix, y + 0.4, iris, iris * 1.08, dna.eyes);
    fillEllipse(ctx, ix, y + 0.6, iris * 0.5, iris * 0.56, "#0c0c0c");
    fillEllipse(ctx, ix - 0.8, y - 0.5, 0.9 * s, 0.9 * s, "#fff");
    ctx.fillStyle = deep(dna.skin, dna.eyeShape === 2 ? 0.5 : 0.38);
    ctx.beginPath();
    ctx.moveTo(x - rxEye, y - 0.2);
    ctx.quadraticCurveTo(x, y - ryEye * (dna.eyeShape === 2 ? 0.55 : 1.05), x + rxEye, y - 0.2);
    ctx.quadraticCurveTo(x, y - ryEye * 0.25, x - rxEye, y - 0.2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = deep(dna.skin, 0.4);
    ctx.lineWidth = dna.eyeShape === 2 ? 1.55 : 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - rxEye, y);
    ctx.quadraticCurveTo(x, y - ryEye * 1.05, x + rxEye, y);
    ctx.stroke();
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x - rxEye * 0.86, y + ryEye * 0.45);
    ctx.quadraticCurveTo(x, y + ryEye * 0.85, x + rxEye * 0.86, y + ryEye * 0.45);
    ctx.stroke();
  }
}

function paintNose(ctx: CanvasRenderingContext2D, dna: FaceDna, look: number): void {
  const w = (dna.noseStyle === 0 ? 2.4 : dna.noseStyle === 2 ? 4.1 : 3.4) * dna.nose;
  const tipY = dna.noseStyle === 0 ? 14.2 : dna.noseStyle === 2 ? 18.4 : 16.6;
  const bridge = dna.noseStyle === 2 ? 1 : 2;
  ctx.fillStyle = deep(dna.skin, 0.18);
  ctx.beginPath();
  ctx.moveTo(-1.1 + look * 0.4, bridge);
  if (dna.noseStyle === 2) {
    ctx.quadraticCurveTo(-w * 0.2, 8, -w * 0.55, 12);
    ctx.quadraticCurveTo(-w * 1.05, 16.5, -w * 0.9, tipY);
  } else {
    ctx.quadraticCurveTo(-w * 0.5, 10, -w * 0.95, tipY - 0.6);
  }
  ctx.quadraticCurveTo(look * 0.2, tipY + 2.6, w * 0.9 + look, tipY - 0.6);
  ctx.quadraticCurveTo(w * 0.35, 11, 0.6 + look * 0.4, bridge);
  ctx.fill();
  ctx.fillStyle = lite(dna.skin, 0.16);
  ctx.beginPath();
  ctx.moveTo(-0.2 + look * 0.2, bridge + 1);
  ctx.quadraticCurveTo(-1.2, 11, -0.5, tipY - 1.6);
  ctx.quadraticCurveTo(1.5 + look, tipY - 2, 0.7 + look * 0.3, bridge + 1);
  ctx.fill();
  fillEllipse(ctx, look * 0.25, tipY + 0.4, w * (dna.noseStyle === 0 ? 1.2 : 1.05), dna.noseStyle === 0 ? 3.6 : 3.1, mix(dna.skin, deep(dna.skin, 0.12), 0.35));
  fillEllipse(ctx, -w * 0.72, tipY + 0.4, dna.noseStyle === 2 ? 2.5 : 1.9, 1.35, deep(dna.skin, 0.28), 0.25);
  fillEllipse(ctx, w * 0.78 + look, tipY + 0.4, dna.noseStyle === 2 ? 2.5 : 1.9, 1.35, deep(dna.skin, 0.2), -0.25);
  if (dna.noseStyle !== 0) fillEllipse(ctx, -0.6, tipY - 3.2, 1.3, 2.2, lite(dna.skin, 0.2));
}

function paintMouth(
  ctx: CanvasRenderingContext2D,
  dna: FaceDna,
  mouth: number,
  talking: boolean,
): void {
  const y = dna.mouthStyle === 2 ? 25.2 : 24;
  const w = (dna.mouthStyle === 0 ? 10.2 : dna.mouthStyle === 2 ? 15.4 : 13.5) * dna.mouthWidth;
  const open = talking ? mouth : dna.mouthStyle === 0 ? 0.02 : 0.06;
  const dip = dna.mouthStyle === 2 ? -1.1 : dna.mouthStyle === 0 ? 0.4 : 2;
  ctx.fillStyle = "#6e3434";
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(0, y + dip + open * 8, w, y);
  ctx.quadraticCurveTo(0, y - (dna.mouthStyle === 0 ? 0.6 : 1.4), -w, y);
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
  const lip = mix(dna.mouthStyle === 1 ? "#b45a58" : "#a35a54", dna.skin, dna.mouthStyle === 0 ? 0.5 : 0.28);
  ctx.fillStyle = lip;
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(-w * 0.35, y - (dna.mouthStyle === 1 ? 3.6 : dna.mouthStyle === 0 ? 1.4 : 2.2), 0, y - (dna.mouthStyle === 1 ? 1.6 : 1.0));
  ctx.quadraticCurveTo(w * 0.35, y - (dna.mouthStyle === 1 ? 3.6 : dna.mouthStyle === 0 ? 1.4 : 2.2), w, y);
  ctx.quadraticCurveTo(0, y + 0.8, -w, y);
  ctx.fill();
  if (!talking || open < 0.2) {
    ctx.fillStyle = mix(dna.mouthStyle === 1 ? "#d08078" : "#c4786a", dna.skin, dna.mouthStyle === 0 ? 0.45 : 0.22);
    ctx.beginPath();
    ctx.moveTo(-w * 0.88, y + 0.4);
    ctx.quadraticCurveTo(0, y + (dna.mouthStyle === 2 ? 1.6 : dna.mouthStyle === 1 ? 4.2 : 2.6), w * 0.88, y + 0.4);
    ctx.quadraticCurveTo(0, y + 1.2, -w * 0.88, y + 0.4);
    ctx.fill();
  }
  if (dna.mouthStyle !== 1) {
    ctx.strokeStyle = deep(dna.skin, 0.22);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-1.8, 19);
    ctx.lineTo(-0.8, 22.4);
    ctx.moveTo(1.8, 19);
    ctx.lineTo(0.8, 22.4);
    ctx.stroke();
  }
}

function paintScar(ctx: CanvasRenderingContext2D, dna: FaceDna): void {
  if (dna.scar === 0) return;
  ctx.strokeStyle = deep(dna.skin, 0.42);
  ctx.lineCap = "round";
  if (dna.scar === 1) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(20, 18);
    ctx.stroke();
  } else if (dna.scar === 2) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(-8, 16);
    ctx.stroke();
  } else {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(-6, -6);
    ctx.stroke();
  }
}

function paintGlasses(ctx: CanvasRenderingContext2D, dna: FaceDna, look: number): void {
  const gap = 10.2 + (1.2 - dna.eyeSize) * 2.4;
  const y = dna.eyeShape === 2 ? -1.2 : -2;
  const rx = (dna.eyeShape === 1 ? 6.8 : 7.6) * dna.eyeSize;
  const ry = (dna.eyeShape === 1 ? 4.8 : 3.8) * dna.eyeSize;
  ctx.strokeStyle = mix("#1c2018", dna.hair, 0.2);
  ctx.lineWidth = 1.55;
  ctx.beginPath();
  ctx.ellipse(-gap + look * 0.3, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(gap + look * 0.3, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-gap + rx - 0.4, y - 0.4);
  ctx.lineTo(gap - rx + 0.4, y - 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-gap - rx, y);
  ctx.lineTo(-gap - rx - 8, y - 2);
  ctx.moveTo(gap + rx, y);
  ctx.lineTo(gap + rx + 8, y - 2);
  ctx.stroke();
}

function paintComplexion(ctx: CanvasRenderingContext2D, dna: FaceDna, jw: number): void {
  if (dna.complexion === 0) return;
  const mark = dna.complexion === 1 ? deep(dna.skin, 0.16) : mix(dna.skin, "#8c6048", 0.22);
  ctx.globalAlpha = dna.complexion === 1 ? 0.24 : 0.32;
  const count = dna.complexion === 1 ? 12 : 7;
  for (let i = 0; i < count; i++) {
    const x = ((i * 17 + dna.faceShape * 5) % 31) - 15;
    const y = 5 + ((i * 11 + dna.hairTexture) % 15);
    if (Math.abs(x) < jw * 0.7) fillEllipse(ctx, x, y, dna.complexion === 1 ? 0.7 : 1.15, 0.65, mark);
  }
  ctx.globalAlpha = 1;
}

function paintAgeDetail(ctx: CanvasRenderingContext2D, dna: FaceDna): void {
  if (dna.ageBand === 0) return;
  ctx.strokeStyle = deep(dna.skin, dna.ageBand === 2 ? 0.3 : 0.18);
  ctx.globalAlpha = dna.ageBand === 2 ? 0.52 : 0.28;
  ctx.lineWidth = 0.75;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 17, 4);
    ctx.lineTo(side * 23, 6);
    ctx.moveTo(side * 18, 8);
    ctx.lineTo(side * 22, 10);
    ctx.stroke();
  }
  if (dna.ageBand === 2) {
    ctx.beginPath();
    ctx.moveTo(-12, 28);
    ctx.quadraticCurveTo(0, 31, 12, 28);
    ctx.moveTo(-12, -13);
    ctx.quadraticCurveTo(0, -10, 12, -13);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintAccessory(ctx: CanvasRenderingContext2D, dna: FaceDna, tone: FaceTone): void {
  if (dna.accessory === 0) return;
  const glow = tone === "enemy" ? "#e07058" : "#5ce1e6";
  if (dna.accessory === 1) {
    ctx.fillStyle = deep(dna.uniform, 0.38);
    ctx.fillRect(20, 10, 7, 4);
    ctx.fillStyle = glow;
    ctx.fillRect(24, 11, 2, 2);
  } else if (dna.accessory === 2) {
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-25, 13);
    ctx.lineTo(-20, 16);
    ctx.lineTo(-18, 22);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = mix(dna.uniform, "#0b1114", 0.45);
    ctx.beginPath();
    ctx.moveTo(-27, -6);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-10, 4);
    ctx.lineTo(-26, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
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
  const faceWidth = [0, -2.2, 2.6, 0.8][dna.faceShape] ?? 0;
  const jw = 26 + dna.jaw * 10 + faceWidth;
  const chin = 34 + (dna.jaw - 1) * 3 + (dna.faceShape === 0 ? 3 : dna.faceShape === 1 ? -2 : 0);
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
  paintComplexion(ctx, dna, jw);
  paintEyes(ctx, dna, blink, look, browY, tone);
  paintNose(ctx, dna, look);
  paintMouth(ctx, dna, mouth, talking);
  paintScar(ctx, dna);
  paintBeard(ctx, dna, jw, chin, 24);
  paintAgeDetail(ctx, dna);
  ctx.restore();

  paintHair(ctx, dna, jw, "front");
  paintHeadgear(ctx, dna, brass, jw);
  if (dna.glasses) paintGlasses(ctx, dna, look);
  paintAccessory(ctx, dna, tone);
  if (dna.headset) paintHeadset(ctx, jw, dna.headgear === 0);
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
