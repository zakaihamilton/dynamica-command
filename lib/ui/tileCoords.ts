import type { Entity, Vec2 } from "@/lib/types";

export function tileCoords(entity: Entity): Vec2 {
  return { x: Math.round(entity.x), y: Math.round(entity.y) };
}

export function tileX(entity: Entity): number {
  return Math.round(entity.x);
}

export function tileY(entity: Entity): number {
  return Math.round(entity.y);
}
