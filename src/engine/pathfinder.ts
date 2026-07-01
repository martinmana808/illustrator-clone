import type paper from "paper";

export type PItem = paper.PathItem;

/** Options passed to every Paper boolean op so results stay out of the layer. */
const NO_INSERT = { insert: false } as const;

/** Sum of absolute areas of the given items. */
export function totalArea(items: PItem[]): number {
  return items.reduce((sum, it) => sum + Math.abs(it.area), 0);
}

/** Clone items without inserting them into the active layer. */
export function cloneItems(items: PItem[]): PItem[] {
  return items.map((it) => it.clone({ insert: false }) as PItem);
}

function unionOf(items: PItem[]): PItem | null {
  if (items.length === 0) return null;
  let acc = items[0].clone({ insert: false }) as PItem;
  for (let i = 1; i < items.length; i++) {
    acc = acc.unite(items[i], NO_INSERT);
  }
  return acc;
}

function reduceBoolean(items: PItem[], op: (a: PItem, b: PItem) => PItem): PItem[] {
  const work = cloneItems(items);
  if (work.length === 0) return [];
  let acc = work[0];
  for (let i = 1; i < work.length; i++) {
    acc = op(acc, work[i]);
  }
  return [acc];
}

// --- Shape Modes -----------------------------------------------------------

export function unite(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.unite(b, NO_INSERT));
}

export function intersect(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.intersect(b, NO_INSERT));
}

/** Illustrator "Minus Front": back-most minus everything in front. */
export function minusFront(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.subtract(b, NO_INSERT));
}

// Paper's native `exclude` yields a CompoundPath whose signed child areas
// cancel (area reads 0) — fragile for downstream ops. Build the symmetric
// difference explicitly as (A−B) ∪ (B−A) for clean winding + correct area.
export function exclude(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => {
    const ab = a.subtract(b, NO_INSERT);
    const ba = b.subtract(a, NO_INSERT);
    return ab.unite(ba, NO_INSERT);
  });
}

/** Illustrator "Minus Back": front-most minus everything behind it. */
export function minusBack(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  if (work.length === 0) return [];
  let acc = work[work.length - 1];
  for (let i = work.length - 2; i >= 0; i--) {
    acc = acc.subtract(work[i], NO_INSERT);
  }
  return [acc];
}

// --- Pathfinders -----------------------------------------------------------

/** Split every region bounded by any input edge into its own face. */
export function divide(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  const faces: PItem[] = [];

  // Exclusive region of each item (item minus union of all others).
  for (let i = 0; i < work.length; i++) {
    const others = work.filter((_, j) => j !== i);
    const u = unionOf(others);
    const exclusive = u
      ? work[i].subtract(u, NO_INSERT)
      : (work[i].clone({ insert: false }) as PItem);
    if (Math.abs(exclusive.area) > 1e-6) faces.push(exclusive);
  }

  // Pairwise intersection faces (each unordered pair once).
  for (let i = 0; i < work.length; i++) {
    for (let j = i + 1; j < work.length; j++) {
      const inter = work[i].intersect(work[j], NO_INSERT);
      if (Math.abs(inter.area) > 1e-6) faces.push(inter);
    }
  }

  return faces;
}

/** Remove the hidden part of each item (covered by anything in front). */
export function trim(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  const out: PItem[] = [];
  for (let i = 0; i < work.length; i++) {
    const inFront = work.slice(i + 1);
    const u = unionOf(inFront);
    const clipped = u ? work[i].subtract(u, NO_INSERT) : work[i];
    if (Math.abs(clipped.area) > 1e-6) out.push(clipped);
  }
  return out;
}

function sameColor(a: PItem, b: PItem): boolean {
  const ca = a.fillColor;
  const cb = b.fillColor;
  if (!ca || !cb) return !ca && !cb;
  return ca.equals(cb);
}

/** Trim, then unite adjacent same-fill-color regions. */
export function merge(items: PItem[]): PItem[] {
  const trimmed = trim(items);
  const out: PItem[] = [];
  const used = new Array(trimmed.length).fill(false);
  for (let i = 0; i < trimmed.length; i++) {
    if (used[i]) continue;
    let acc = trimmed[i];
    for (let j = i + 1; j < trimmed.length; j++) {
      if (used[j]) continue;
      if (sameColor(acc, trimmed[j])) {
        acc = acc.unite(trimmed[j], NO_INSERT);
        used[j] = true;
      }
    }
    used[i] = true;
    out.push(acc);
  }
  return out;
}

/** Keep only the parts of lower items inside the front-most (crop) shape. */
export function crop(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  if (work.length < 2) return work;
  const top = work[work.length - 1];
  const out: PItem[] = [];
  for (let i = 0; i < work.length - 1; i++) {
    const inside = work[i].intersect(top, NO_INSERT);
    if (Math.abs(inside.area) > 1e-6) out.push(inside);
  }
  return out;
}

/** Divide into faces, then render each face as an unfilled stroked outline. */
export function outline(items: PItem[]): PItem[] {
  const faces = divide(items);
  return faces.map((f) => {
    f.fillColor = null;
    // String assignment lets Paper build the Color in the item's own scope.
    (f as unknown as { strokeColor: string }).strokeColor = "black";
    f.strokeWidth = 1;
    return f;
  });
}

// --- Registry --------------------------------------------------------------

export type PathfinderOp =
  | "unite"
  | "minusFront"
  | "intersect"
  | "exclude"
  | "divide"
  | "trim"
  | "merge"
  | "crop"
  | "outline"
  | "minusBack";

export const PATHFINDER_OPS: {
  id: PathfinderOp;
  label: string;
  run(items: PItem[]): PItem[];
}[] = [
  { id: "unite", label: "Unite", run: unite },
  { id: "minusFront", label: "Minus Front", run: minusFront },
  { id: "intersect", label: "Intersect", run: intersect },
  { id: "exclude", label: "Exclude", run: exclude },
  { id: "divide", label: "Divide", run: divide },
  { id: "trim", label: "Trim", run: trim },
  { id: "merge", label: "Merge", run: merge },
  { id: "crop", label: "Crop", run: crop },
  { id: "outline", label: "Outline", run: outline },
  { id: "minusBack", label: "Minus Back", run: minusBack },
];

export function applyPathfinder(op: PathfinderOp, items: PItem[]): PItem[] {
  const found = PATHFINDER_OPS.find((o) => o.id === op);
  if (!found) throw new Error(`Unknown pathfinder op: ${op}`);
  return found.run(items);
}
