export type HandleName = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HANDLES: HandleName[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const OPPOSITE: Record<HandleName, HandleName> = {
  nw: "se",
  n: "s",
  ne: "sw",
  e: "w",
  se: "nw",
  s: "n",
  sw: "ne",
  w: "e",
};

/** Position of a named handle on a bounds rectangle. */
export function handlePoint(b: BoundsLike, name: HandleName): { x: number; y: number } {
  const l = b.x;
  const t = b.y;
  const r = b.x + b.width;
  const bot = b.y + b.height;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  switch (name) {
    case "nw": return { x: l, y: t };
    case "n": return { x: cx, y: t };
    case "ne": return { x: r, y: t };
    case "e": return { x: r, y: cy };
    case "se": return { x: r, y: bot };
    case "s": return { x: cx, y: bot };
    case "sw": return { x: l, y: bot };
    case "w": return { x: l, y: cy };
  }
}

export function handlePoints(b: BoundsLike): { name: HandleName; x: number; y: number }[] {
  return HANDLES.map((name) => ({ name, ...handlePoint(b, name) }));
}

/** The pivot (opposite handle) used when scaling from a given handle. */
export function pivotFor(name: HandleName, b: BoundsLike): { x: number; y: number } {
  return handlePoint(b, OPPOSITE[name]);
}

/** Which axes a handle scales (edges scale one axis only). */
export function axisFactors(name: HandleName): { ax: 0 | 1; ay: 0 | 1 } {
  const ax = name === "n" || name === "s" ? 0 : 1;
  const ay = name === "e" || name === "w" ? 0 : 1;
  return { ax, ay };
}

/** Nearest handle within `tol` of (x, y), or null. */
export function hitHandle(b: BoundsLike, x: number, y: number, tol: number): HandleName | null {
  let best: HandleName | null = null;
  let bestD = tol;
  for (const name of HANDLES) {
    const p = handlePoint(b, name);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/**
 * Classify a pointer-down over a selection's bounds:
 * - a scale handle, or
 * - the rotation ring (outside the box but within `rotZone` of a corner), or
 * - null (inside/elsewhere).
 */
export function hitTransform(
  b: BoundsLike,
  x: number,
  y: number,
  handleTol: number,
  rotZone: number
): { kind: "scale"; handle: HandleName } | { kind: "rotate" } | null {
  const handle = hitHandle(b, x, y, handleTol);
  if (handle) return { kind: "scale", handle };

  const inside =
    x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  if (inside) return null;

  // Outside the box: rotation ring if near a corner.
  for (const name of ["nw", "ne", "se", "sw"] as HandleName[]) {
    const p = handlePoint(b, name);
    if (Math.hypot(p.x - x, p.y - y) <= rotZone) return { kind: "rotate" };
  }
  return null;
}
