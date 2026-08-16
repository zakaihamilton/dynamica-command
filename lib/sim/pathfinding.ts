import type { SimState, Vec2 } from "../types";
import { inBounds, isWalkable } from "./world";

type Node = { x: number; y: number; g: number; f: number; px: number; py: number };

const DIRS: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export function findPath(
  state: SimState,
  from: Vec2,
  to: Vec2,
  maxNodes = 2500,
): Vec2[] {
  const sx = Math.round(from.x);
  const sy = Math.round(from.y);
  const gx = Math.round(to.x);
  const gy = Math.round(to.y);
  if (sx === gx && sy === gy) return [];
  if (!inBounds(state, gx, gy)) return [];

  const walkableGoal = isWalkable(state, gx, gy);
  const goalOk = (x: number, y: number) =>
    walkableGoal ? x === gx && y === gy : Math.max(Math.abs(x - gx), Math.abs(y - gy)) === 1;

  const w = state.width;
  const key = (x: number, y: number) => y * w + x;
  const open: Node[] = [{ x: sx, y: sy, g: 0, f: heuristic(sx, sy, gx, gy), px: -1, py: -1 }];
  const came = new Map<number, Node>();
  const gScore = new Map<number, number>([[key(sx, sy), 0]]);
  let explored = 0;

  while (open.length && explored < maxNodes) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestI]!.f) bestI = i;
    }
    const current = open.splice(bestI, 1)[0]!;
    explored++;
    came.set(key(current.x, current.y), current);
    if (goalOk(current.x, current.y) && !(current.x === sx && current.y === sy && !walkableGoal)) {
      if (current.x === sx && current.y === sy) continue;
      return reconstruct(came, current, w);
    }
    for (const d of DIRS) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      if (!inBounds(state, nx, ny)) continue;
      const isGoal = nx === gx && ny === gy;
      if (!isWalkable(state, nx, ny) && !(isGoal && !walkableGoal)) continue;
      const step = d.x !== 0 && d.y !== 0 ? 1.414 : 1;
      const tentative = current.g + step;
      const k = key(nx, ny);
      if (tentative >= (gScore.get(k) ?? Infinity)) continue;
      gScore.set(k, tentative);
      open.push({
        x: nx,
        y: ny,
        g: tentative,
        f: tentative + heuristic(nx, ny, gx, gy),
        px: current.x,
        py: current.y,
      });
    }
  }
  return [];
}

function heuristic(x: number, y: number, gx: number, gy: number): number {
  const dx = Math.abs(x - gx);
  const dy = Math.abs(y - gy);
  return dx + dy + (1.414 - 2) * Math.min(dx, dy);
}

function reconstruct(came: Map<number, Node>, end: Node, w: number): Vec2[] {
  const path: Vec2[] = [];
  let cur: Node | undefined = end;
  while (cur && cur.px >= 0) {
    path.push({ x: cur.x, y: cur.y });
    cur = came.get(cur.py * w + cur.px);
  }
  path.reverse();
  return path;
}

export function stepAlongPath(e: { x: number; y: number; path: Vec2[] }, speed: number): void {
  if (!e.path.length) return;
  const target = e.path[0]!;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= speed || d < 0.05) {
    e.x = target.x;
    e.y = target.y;
    e.path.shift();
    return;
  }
  e.x += (dx / d) * speed;
  e.y += (dy / d) * speed;
}
