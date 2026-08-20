import { UNIT_STATS, footprintOf } from "../catalog";
import { buildingSprite, unitSprite } from "../gen/assets";
import { generateVisualProfile } from "../gen/visualProfile";
import type { BuildingKind, Entity, SimState, SpriteSpec, UnitKind } from "../types";
import {
  animClock,
  buildingAnim,
  facingVector,
  selectionPulse,
  unitAnim,
} from "./anim";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import {
  emptyScrollLayer,
  scrollLayerBlitOffset,
  scrollLayerNeedsRebuild,
  scrollLayerPaintCamera,
  terrainScrollPad,
  type ScrollLayer,
} from "./scrollLayer";
import { drawSprite, isRasterReady, rasterize } from "./sprites";
import { drawUnitShadow, paintUnitMovementFx } from "./unitMotion";
import { canPlaceBuilding, heightAt } from "../sim/world";
import { canRepair } from "../sim/repair";
import { canSell } from "../sim/sell";
import { computeUnitDynamicTransform, updateUnitHistory } from "./gl/unitTransformTracker";
import { paintBuildingPlates, paintTerrainWorld } from "./terrainPaint";
import { paintOreGlints, paintTerrainWeather, paintWaterFx } from "./terrainWeather";
import { isPerfHudEnabled, type WorldPhaseTimings } from "./perfHud";
import {
  entityAtPointer,
  entityElev,
  entityVisible,
  pickTile,
  renderEntityOpacity,
  visibleBuildingAt,
} from "./renderPicking";
import {
  drawBuildingFx,
  drawBuildingShadow,
  drawHarvestFx,
  drawTurretCannon,
  strokeFootprint,
} from "./renderStructures";
import {
  drawCombatEffects,
  drawFxLayer,
  isExtractableUnit,
  isLockedContactUnit,
  isScenarioTarget,
} from "./renderCombat";
import {
  drawDamageOverlay,
  drawDiamond,
  drawDiamondStroke,
  drawObjectiveZone,
  drawRescueHalo,
  drawSelectBox,
  drawTooltip,
  drawUnitGlow,
  drawUnitHealthMeter,
  tileTooltipLines,
  tooltipLines,
  type RenderExtras,
} from "./renderOverlays";
import {
  constructionStage,
  depthOf,
  entityVariant,
  facingFor as resolveFacing,
} from "./renderEntities";

export {
  pickTile,
  visibleBuildingAt,
  entityAtPointer,
  isExtractableUnit,
  isLockedContactUnit,
  isScenarioTarget,
  drawTooltip,
  drawUnitHealthMeter,
  tooltipLines,
  tileTooltipLines,
  type RenderExtras,
};

const TERRAIN_RENDER_REV = "world-atlas-v12-organic-cliffs";

const terrainScroll: ScrollLayer = emptyScrollLayer();
let terrainCanvas: HTMLCanvasElement | null = null;
const entityById = new Map<number, Entity>();
const drawList: Entity[] = [];
const lastReadySprite = new Map<number, { spec: SpriteSpec; img: HTMLCanvasElement }>();

function ensureTerrainCanvas(bw: number, bh: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!terrainCanvas) {
    terrainCanvas = document.createElement("canvas");
  }
  if (terrainCanvas.width !== bw || terrainCanvas.height !== bh) {
    terrainCanvas.width = bw;
    terrainCanvas.height = bh;
    terrainScroll.key = "";
  }
  return terrainCanvas;
}

export function terrainContentKey(state: SimState, cam: Camera, w: number, h: number): string {
  return `${state.seed}:${state.tick >> 4}:${state.width}x${state.height}:${state.biome}:${TERRAIN_RENDER_REV}:${cam.zoom.toFixed(3)}:${w}x${h}`;
}

function paintTerrain(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  paintTerrainWorld(ctx, state, cam);
}

export function invalidateTerrainCache(): void {
  terrainScroll.key = "";
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  selected: Set<number>,
  hoverTile: { x: number; y: number } | null,
  extras: RenderExtras = {},
): WorldPhaseTimings | null {
  const profile = isPerfHudEnabled();
  const timings: WorldPhaseTimings = { terrain: 0, fx: 0, entities: 0, combat: 0 };
  let mark = profile ? performance.now() : 0;
  const lap = (key: keyof WorldPhaseTimings) => {
    if (!profile) return;
    const now = performance.now();
    timings[key] = now - mark;
    mark = now;
  };

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";

  const pad = terrainScrollPad(cam.zoom);
  const contentKey = terrainContentKey(state, cam, w, h);
  const layer = ensureTerrainCanvas(w + pad * 2, h + pad * 2);
  if (layer && scrollLayerNeedsRebuild(terrainScroll, contentKey, cam.x, cam.y)) {
    const tctx = layer.getContext("2d");
    if (tctx) {
      paintTerrain(tctx, state, scrollLayerPaintCamera(cam, pad));
      terrainScroll.key = contentKey;
      terrainScroll.originX = cam.x;
      terrainScroll.originY = cam.y;
      terrainScroll.pad = pad;
    }
  }
  if (layer && terrainScroll.key === contentKey) {
    const blit = scrollLayerBlitOffset(terrainScroll, cam.x, cam.y);
    ctx.drawImage(layer, blit.x, blit.y);
  } else {
    paintTerrain(ctx, state, cam);
  }
  lap("terrain");
  const clock = extras.clockMs;
  const timeMs = animClock(state.tick, clock);
  paintWaterFx(ctx, state, cam, timeMs);
  paintOreGlints(ctx, state, cam, timeMs);
  paintTerrainWeather(ctx, state, cam, timeMs);
  paintBuildingPlates(ctx, state, cam, footprintOf, entityVisible, entityElev);
  drawObjectiveZone(ctx, state, cam, timeMs, heightAt);

  if (extras.placeKind && hoverTile) {
    const fp = footprintOf(extras.placeKind);
    const ok = canPlaceBuilding(state, extras.placeKind, hoverTile.x, hoverTile.y);
    for (let oy = 0; oy < fp.h; oy++) {
      for (let ox = 0; ox < fp.w; ox++) {
        const tx = hoverTile.x + ox;
        const ty = hoverTile.y + oy;
        const elev = heightAt(state, tx, ty);
        const s = tileToScreen(tx, ty, cam, elev);
        ctx.strokeStyle = ok ? "rgba(90,220,120,0.95)" : "rgba(220,70,70,0.95)";
        ctx.fillStyle = ok ? "rgba(90,220,120,0.18)" : "rgba(220,70,70,0.18)";
        ctx.lineWidth = 2;
        drawDiamond(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  lap("fx");

  entityById.clear();
  drawList.length = 0;
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    entityById.set(e.id, e);
    drawList.push(e);
  }
  drawList.sort((a, b) => depthOf(a) - depthOf(b));

  drawFxLayer(ctx, state, cam, extras.fx, timeMs, "ground");

  const z = cam.zoom;
  const cullPad = Math.max(128, 140 * z);
  updateUnitHistory(state, timeMs);

  for (const e of drawList) {
    const entityAlpha = renderEntityOpacity(state, e, timeMs);
    if (entityAlpha <= 0.01) continue;
    let cx = e.x;
    let cy = e.y;
    let elev = entityElev(state, e);
    const uAnim = e.class === "unit" ? unitAnim(e, state.tick, clock) : null;
    const bAnim = e.class === "building" ? buildingAnim(e, state.tick, clock) : null;
    const damageStage = bAnim?.damageStage ?? (e.hp / e.maxHp < 0.34 ? 2 : e.hp / e.maxHp < 0.67 ? 1 : 0);

    if (e.class === "unit") {
      const dyn = computeUnitDynamicTransform(e, state, extras.subTickAlpha ?? 0, timeMs, entityById);
      cx = dyn.x;
      cy = dyn.y;
      elev = dyn.z;
    } else {
      const fp = footprintOf(e.kind as BuildingKind);
      cx = e.x + (fp.w - 1) / 2;
      cy = e.y + (fp.h - 1) / 2;
    }
    const s = tileToScreen(cx, cy, cam, elev);
    if (s.x < -cullPad || s.y < -cullPad || s.x > w + cullPad || s.y > h + cullPad) continue;
    const pal = state.factions[e.owner]!.palette;
    const profile = generateVisualProfile(state.seed, e.owner);
    const facing = resolveFacing(state, e, entityById, e.class === "unit" ? { x: cx, y: cy } : undefined);

    let spec = e.class === "unit"
      ? unitSprite(e.kind as UnitKind, pal, {
          variant: entityVariant(state, e),
          facing,
          animationFrame: uAnim?.frame,
          damageStage,
          profile,
        })
      : buildingSprite(e.kind as BuildingKind, pal, {
          variant: entityVariant(state, e),
          damageStage,
          constructionStage: constructionStage(e),
          profile,
        });
    if (isScenarioTarget(state, e)) drawRescueHalo(ctx, s.x, s.y, z, timeMs);
    let img = rasterize(spec);
    if (spec.imageSrc && !isRasterReady(spec)) {
      const previous = lastReadySprite.get(e.id);
      if (previous) {
        spec = previous.spec;
        img = previous.img;
      }
    } else {
      lastReadySprite.set(e.id, { spec, img });
    }
    const ax = (spec.anchorX ?? spec.w / 2) * z;
    const ay = (spec.anchorY ?? spec.h) * z;
    const dir = facingVector(facing);
    const recoil = uAnim?.recoil ?? 0;
    const groundX = s.x;
    const groundY = s.y + (TILE_H / 2) * z;

    if (e.class === "building") {
      drawBuildingShadow(ctx, state, cam, e, z);
    } else {
      drawUnitShadow(
        ctx,
        e.kind as UnitKind,
        groundX,
        groundY,
        z,
        entityAlpha,
        uAnim?.pose === "move",
      );
    }

    const dx = Math.round(s.x - ax - dir.x * recoil * 3 * z);
    const dy = Math.round(groundY - ay - (uAnim?.bobY ?? 0) * z + dir.y * recoil * 3 * z);

    if (uAnim?.pose === "move") {
      paintUnitMovementFx(
        ctx,
        e.kind as UnitKind,
        dx,
        dy,
        spec.w * z,
        spec.h * z,
        groundY,
        z,
        uAnim.frame,
        entityAlpha,
        {
          strideRatio: uAnim.strideRatio,
          stridePhase: uAnim.stridePhase,
        },
      );
    }

    const spriteReady = !spec.imageSrc || isRasterReady(spec);
    const spriteAlpha = entityAlpha;
    if (spriteReady && isExtractableUnit(state, e)) {
      drawUnitGlow(ctx, spec, img, dx, dy, spec.w * z, spec.h * z, timeMs, spriteAlpha, z);
    }
    if (spriteReady) {
      ctx.globalAlpha = spriteAlpha;
      drawSprite(ctx, spec, img, dx, dy, spec.w * z, spec.h * z);
      ctx.globalAlpha = 1;
    }
    if (spriteReady && e.class !== "building") {
      drawDamageOverlay(
        ctx,
        spec,
        dx,
        dy,
        spec.w * z,
        spec.h * z,
        damageStage,
        timeMs,
        e.id,
        spriteAlpha,
      );
    }

    if (bAnim) drawBuildingFx(ctx, e, s, z, bAnim);
    if (e.kind === "turret" && e.class === "building") {
      const targetEntity = e.attackTarget !== undefined ? entityById.get(e.attackTarget) : undefined;
      drawTurretCannon(ctx, e, s, z, state, cam, timeMs, targetEntity);
    }
    if (uAnim?.pose === "work") drawHarvestFx(ctx, state, e, cam, timeMs);
    if (uAnim?.pose === "attack" && recoil > 0.45) {
      ctx.fillStyle = "#fff4c4";
      ctx.fillRect(Math.round(s.x + dir.x * 16 * z - 2), Math.round(s.y + dir.y * 16 * z), 4, 4);
    }

    if (selected.has(e.id)) {
      const pulse = selectionPulse(timeMs);
      ctx.strokeStyle = "#f5e6a8";
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.lineWidth = 3;
      if (e.class === "building") {
        const fp = footprintOf(e.kind as BuildingKind);
        strokeFootprint(ctx, state, cam, e.x, e.y, fp.w, fp.h);
      } else {
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + (TILE_H / 2) * z, (16 + pulse * 3) * z, (6 + pulse * 1.5) * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (e.class === "unit") {
      const isSelected = selected.has(e.id);
      const barW = Math.max(16, Math.round(Math.min(spec.w * 0.75, 24) * z));
      const meterY = Math.round(dy - 7 * z);
      const centerX = Math.round(dx + (spec.w * z) / 2);
      drawUnitHealthMeter(ctx, centerX, meterY, e.hp, e.maxHp, z, spriteAlpha, isSelected, barW);

      if ((e.suppression ?? 0) > 0) {
        const suppW = barW;
        const suppX = Math.round(centerX - suppW / 2);
        const suppY = meterY + Math.max(3, Math.round(3.5 * z)) + 2;
        ctx.save();
        ctx.globalAlpha = spriteAlpha;
        ctx.fillStyle = "rgba(8, 12, 14, 0.85)";
        ctx.fillRect(suppX - 1, suppY - 1, suppW + 2, 3);
        ctx.fillStyle = "#5b9ae8";
        ctx.fillRect(suppX, suppY, Math.round((suppW * (e.suppression ?? 0)) / 100), 2);
        ctx.restore();
      }
    }
  }

  for (const id of lastReadySprite.keys()) {
    if (!entityById.has(id) || (entityById.get(id)?.hp ?? 0) <= 0) lastReadySprite.delete(id);
  }

  for (const id of selected) {
    const selectedEntity = entityById.get(id);
    if (!selectedEntity || selectedEntity.owner !== 0) continue;
    const center = tileToScreen(selectedEntity.x, selectedEntity.y, cam, entityElev(state, selectedEntity));
    const range = selectedEntity.kind === "turret" ? 7 : selectedEntity.class === "unit" ? UNIT_STATS[selectedEntity.kind as UnitKind].range : 0;
    if (range > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(100, 220, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4 * z, 4 * z]);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y + TILE_H * z * 0.5, range * TILE_W * z * 0.5, range * TILE_H * z * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  lap("entities");

  drawCombatEffects(ctx, state, cam, drawList, entityById, (st, ent) => resolveFacing(st, ent, entityById), clock);
  drawFxLayer(ctx, state, cam, extras.fx, timeMs, "burst");
  drawSelectBox(ctx, extras.selectBox);

  if (hoverTile && !extras.placeKind && (extras.repairMode || extras.sellMode)) {
    const hovered = visibleBuildingAt(state, hoverTile.x, hoverTile.y);
    if (hovered && hovered.hp > 0) {
      const fp = footprintOf(hovered.kind as BuildingKind);
      const ok = hovered.owner === 0 && (
        extras.repairMode
          ? hovered.repairing || canRepair(hovered)
          : canSell(hovered)
      );
      const tone = extras.repairMode ? "90,220,200" : "220,190,70";
      ctx.strokeStyle = ok ? `rgba(${tone},0.95)` : "rgba(220,70,70,0.95)";
      ctx.fillStyle = ok ? `rgba(${tone},0.16)` : "rgba(220,70,70,0.16)";
      ctx.lineWidth = 2;
      for (let oy = 0; oy < fp.h; oy++) {
        for (let ox = 0; ox < fp.w; ox++) {
          const tx = hovered.x + ox;
          const ty = hovered.y + oy;
          const elev = heightAt(state, tx, ty);
          const s = tileToScreen(tx, ty, cam, elev);
          drawDiamond(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  if (hoverTile && !extras.placeKind && !extras.repairMode && !extras.sellMode) {
    const s = tileToScreen(hoverTile.x, hoverTile.y, cam, heightAt(state, hoverTile.x, hoverTile.y));
    ctx.strokeStyle = "rgba(255,255,200,0.7)";
    ctx.lineWidth = 1.5;
    drawDiamondStroke(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
    const hovered = visibleBuildingAt(state, hoverTile.x, hoverTile.y);
    if (hovered) {
      const fp = footprintOf(hovered.kind as BuildingKind);
      ctx.strokeStyle = "rgba(245,230,168,0.45)";
      strokeFootprint(ctx, state, cam, hovered.x, hovered.y, fp.w, fp.h);
    }
  }

  const cursor = extras.cursor;
  if (cursor) {
    const ent = entityAtPointer(state, cursor.x, cursor.y, cam);
    if (ent) {
      const elev = entityElev(state, ent);
      let cx = ent.x;
      let cy = ent.y;
      let unitH = 42;
      if (ent.class === "building") {
        const fp = footprintOf(ent.kind as BuildingKind);
        cx = ent.x + (fp.w - 1) / 2;
        cy = ent.y + (fp.h - 1) / 2;
        unitH = 55;
      } else {
        unitH = ent.kind === "infantry" ? 44 : ent.kind === "antiArmor" ? 48 : 56;
      }
      const s = tileToScreen(cx, cy, cam, elev);
      drawTooltip(ctx, s.x, s.y - unitH * cam.zoom, tooltipLines(state, ent, extras), w, h, true);
    } else if (hoverTile) {
      const s = tileToScreen(hoverTile.x, hoverTile.y, cam, heightAt(state, hoverTile.x, hoverTile.y));
      drawTooltip(ctx, s.x, s.y - 18 * cam.zoom, tileTooltipLines(state, hoverTile.x, hoverTile.y), w, h, true);
    }
  }
  lap("combat");
  return profile ? timings : null;
}
