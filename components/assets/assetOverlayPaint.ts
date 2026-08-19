import { buildingAnim } from "@/lib/render/anim";
import { buildTurretHeadModel, type UnitModel } from "@/lib/render/gl/modelLoader";
import { draw3dModel } from "@/lib/render/gl/modelRenderer";
import type { BuildingKind, Entity, Facing, Palette } from "@/lib/types";

let cachedTurretModel: UnitModel | null = null;
function getTurretModel(): UnitModel {
  if (!cachedTurretModel) {
    cachedTurretModel = buildTurretHeadModel();
  }
  return cachedTurretModel;
}

function fakeBuilding(kind: BuildingKind): Entity {
  return {
    id: 1,
    owner: 0,
    class: "building",
    kind,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    cooldown: 0,
    path: [],
    carry: 0,
    constructing: 0,
    queue: [],
    marked: false,
    idle: true,
  };
}

export function paintBuildingAssetOverlay(
  ctx: CanvasRenderingContext2D,
  kind: BuildingKind,
  cx: number,
  cy: number,
  scale: number,
  timeMs: number,
  facing: Facing = 0,
  playing: boolean = true,
  palette?: Palette,
): void {
  const anim = buildingAnim(fakeBuilding(kind), 0, timeMs);
  ctx.save();
  if (anim.lightOn && (kind === "power" || kind === "constructionYard" || kind === "objective" || kind === "turret")) {
    ctx.fillStyle = kind === "objective" ? "#f3dc79" : "#c7f0d4";
    ctx.globalAlpha = 0.5 + anim.smoke * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx + 6 * scale, cy - 12 * scale, 3.5 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "refinery" || kind === "power" || kind === "factory" || anim.damageStage > 0) {
    const puff = anim.smoke;
    for (let i = 0; i < 2; i++) {
      const rise = (12 + puff * 14 + i * 7) * scale;
      ctx.globalAlpha = (0.2 + puff * 0.22) * (1 - i * 0.18);
      ctx.fillStyle = "rgba(190,190,180,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx - (8 - i * 6) * scale, cy - rise, (4 + puff * 4 + i * 2) * scale, (3 + puff * 3 + i) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if ((kind === "barracks" || kind === "factory") && anim.doorOpen) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffc14a";
    ctx.fillRect(cx - 6 * scale, cy + 4 * scale, 12 * scale, 5 * scale);
  }
  if (kind === "turret") {
    let currentAngle = (facing / 8) * Math.PI * 2;
    if (playing) {
      const sweep = Math.sin(timeMs * 0.0012) * 0.55;
      currentAngle += sweep;
    }
    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 16, 0.50)";
    ctx.beginPath();
    ctx.ellipse(cx - 0.5 * scale, cy + 0.5 * scale, 14 * scale, 7.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const model = getTurretModel();
    draw3dModel(ctx, model, cx, cy - 3 * scale, scale, currentAngle - Math.PI / 4, palette);
  }
  ctx.restore();
}
