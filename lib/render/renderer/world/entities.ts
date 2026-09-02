import { footprintOf } from "../../../catalog";
import { buildingSprite, unitSprite } from "../../../gen/assets";
import { generateVisualProfile } from "../../../gen/visualProfile";
import type { BuildingKind, SimState, UnitKind } from "../../../types";
import {
  animClock,
  buildingAnim,
  facingVector,
  selectionPulse,
  unitAnim,
} from "../../anim";
import { TILE_H, tileToScreen, type Camera } from "../../../iso";
import { drawSprite, isRasterReady, rasterize } from "../../sprites";
import { drawUnitIffMarker } from "../../iff";
import { drawUnitShadow, paintUnitMovementFx } from "../../unitMotion";
import { computeUnitDynamicTransform, updateUnitHistory } from "../../gl/unitTransformTracker";
import { isPerfHudEnabled, type WorldPhaseTimings } from "../../perfHud";
import {
  entityElev,
  renderEntityOpacity,
} from "../../renderPicking";
import {
  drawBuildingFx,
  drawBuildingShadow,
  drawHarvestFx,
  drawTurretCannon,
  strokeFootprint,
} from "../../renderStructures";
import {
  drawFxLayer,
  isExtractableUnit,
  isScenarioTarget,
} from "../../renderCombat";
import {
  drawDamageOverlay,
  drawRescueHalo,
  drawUnitGlow,
  drawUnitHealthMeter,
  entityHasWorldHealthMeter,
  worldHealthMeterLayout,
} from "../../renderOverlays";
import {
  constructionStage,
  depthOf,
  entityVariant,
  facingFor as resolveFacing,
} from "../../renderEntities";

import {
  drawList,
  entityById,
  lastReadySprite,
  spriteCacheKey,
  spriteSessionKey,
} from "../cache";

export function renderEntityPhase(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  selected: Set<number>,
  w: number,
  h: number,
  clock: number | undefined,
  extras: {
    subTickAlpha?: number;
    fx?: import("../../renderOverlays").RenderExtras["fx"];
  },
): WorldPhaseTimings | null {
  const profile = isPerfHudEnabled();
  const timings: WorldPhaseTimings = { terrain: 0, fx: 0, entities: 0, combat: 0 };

  const timeMs = animClock(state.tick, clock);

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
    const cacheKey = spriteCacheKey(state, e);
    if (spec.imageSrc && !isRasterReady(spec)) {
      const previous = lastReadySprite.get(cacheKey);
      if (previous) {
        spec = previous.spec;
        img = previous.img;
      }
    } else {
      lastReadySprite.set(cacheKey, { spec, img });
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

    if (e.class === "unit") {
      drawUnitIffMarker(
        ctx,
        e.kind as UnitKind,
        groundX,
        groundY,
        z,
        entityAlpha,
        e.owner,
        e.neutral === true,
      );
    }

    if (bAnim) drawBuildingFx(ctx, e, s, z, bAnim);
    if (e.kind === "turret" && e.class === "building") {
      const targetEntity = e.attackTarget !== undefined ? entityById.get(e.attackTarget) : undefined;
      drawTurretCannon(ctx, e, s, z, state, cam, timeMs, targetEntity);
    }
    if (uAnim?.pose === "work") drawHarvestFx(ctx, state, e, cam, timeMs);

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

    if (entityHasWorldHealthMeter(e)) {
      const isSelected = selected.has(e.id);
      const { barW, meterY, centerX } = worldHealthMeterLayout(e, spec, dx, dy, s.y, z);
      drawUnitHealthMeter(
        ctx,
        centerX,
        meterY,
        e.hp,
        e.maxHp,
        z,
        spriteAlpha,
        isSelected,
        barW,
        e.owner,
        e.neutral === true,
      );

      if (e.class === "unit" && (e.suppression ?? 0) > 0) {
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

  const currentSessionPrefix = `${spriteSessionKey(state)}:`;
  for (const key of lastReadySprite.keys()) {
    if (!key.startsWith(currentSessionPrefix)) {
      lastReadySprite.delete(key);
      continue;
    }
    const id = Number(key.slice(currentSessionPrefix.length));
    if (!entityById.has(id) || (entityById.get(id)?.hp ?? 0) <= 0) lastReadySprite.delete(key);
  }

  return profile ? timings : null;
}
