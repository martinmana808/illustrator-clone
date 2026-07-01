# Pathfinder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** All 10 Illustrator Pathfinder operations as pure functions over Paper.js paths — 4 Shape Modes (Unite, Minus Front, Intersect, Exclude) + 6 Pathfinders (Divide, Trim, Merge, Crop, Outline, Minus Back) — unit-tested by output geometry, then exposed via a Pathfinder panel.

**Architecture:** A pure module `src/engine/pathfinder.ts` operates on an ordered array of `paper.PathItem` (front = last, matching z-order) and returns new `PathItem`s, never mutating inputs or touching the DOM. Shape Modes wrap Paper's boolean ops. The 6 Pathfinders are built from boolean primitives + region reconstruction. A thin React panel calls these on the current selection and replaces it with the result.

**Tech Stack:** Paper.js boolean ops (`unite`/`subtract`/`intersect`/`exclude`), TypeScript, Vitest (jsdom + stubbed canvas).

## Global Constraints

- Pure functions: inputs are cloned before operating; inputs are never mutated.
- Z-order convention: `items[0]` is backmost, `items[items.length - 1]` is frontmost ("front"/"topmost").
- Each op returns `paper.PathItem[]` (a Path or CompoundPath per resulting piece). Callers insert/replace.
- Every op is unit-tested on known rectangles/circles asserting area and piece count.
- Paper.js only via `src/engine/*`.
- Ops operate on `paper.PathItem` (covers both `Path` and `CompoundPath`, since booleans can yield compound paths).

---

## Reference geometry for tests

Two unit squares used across tests, area 100 each, overlapping in a 50×50 = 2500-area (i.e. 50*50) region... using 100-wide squares offset by 50:
- `A` = square at (0,0) size 100 → area 10000.
- `B` = square at (50,50) size 100 → area 10000.
- Overlap = 50×50 = 2500.
- Unite area = 10000 + 10000 − 2500 = 17500.
- Intersect area = 2500.
- A minus B (B on top removed from A) = 10000 − 2500 = 7500.
- Exclude area = 17500 − 2500 = 15000 (union minus intersection).

---

### Task 1: Module scaffold + helpers (clone, area, order)

**Files:**
- Create: `src/engine/pathfinder.ts`, `src/engine/__tests__/pathfinder.test.ts`

**Interfaces (Produces):**
- `type PItem = paper.PathItem;`
- `function totalArea(items: PItem[]): number` — sum of absolute areas.
- Internal `cloneItems(items: PItem[]): PItem[]` (not inserted).
- A shared test factory that builds A and B squares in a fresh document.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import { totalArea } from "../pathfinder";
import type paper from "paper";

function squares(doc: ReturnType<typeof createDocument>) {
  const s = doc.scope;
  const A = new s.Path.Rectangle({ point: [0, 0], size: [100, 100] });
  const B = new s.Path.Rectangle({ point: [50, 50], size: [100, 100] });
  A.fillColor = new s.Color(1, 0, 0);
  B.fillColor = new s.Color(0, 0, 1);
  return { A: A as paper.PathItem, B: B as paper.PathItem };
}

describe("pathfinder helpers", () => {
  it("totalArea sums absolute areas", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    expect(totalArea([A, B])).toBeCloseTo(20000, 3);
  });
});

export { squares };
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement scaffold** `src/engine/pathfinder.ts`:

```ts
import type paper from "paper";

export type PItem = paper.PathItem;

/** Sum of absolute areas of the given items. */
export function totalArea(items: PItem[]): number {
  return items.reduce((sum, it) => sum + Math.abs(it.area), 0);
}

/** Clone items without inserting them into the active layer. */
export function cloneItems(items: PItem[]): PItem[] {
  return items.map((it) => it.clone({ insert: false }) as PItem);
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder module scaffold + area helper`.

---

### Task 2: Shape Modes — Unite, Intersect, Minus Front, Exclude

**Files:** Modify `pathfinder.ts`; add tests.

**Interfaces (Produces):**
- `unite(items: PItem[]): PItem[]`
- `intersect(items: PItem[]): PItem[]`
- `minusFront(items: PItem[]): PItem[]`
- `exclude(items: PItem[]): PItem[]`

Each reduces the array with the corresponding Paper boolean, front-to-back semantics per Illustrator.

- [ ] **Step 1: Add failing tests**

```ts
import { unite, intersect, minusFront, exclude } from "../pathfinder";

describe("pathfinder shape modes", () => {
  it("unite merges to a single piece of the union area", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = unite([A, B]);
    expect(out.length).toBe(1);
    expect(Math.abs(out[0].area)).toBeCloseTo(17500, 1);
  });

  it("intersect keeps only the overlap", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = intersect([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(2500, 1);
  });

  it("minusFront subtracts the front (B) from the back (A)", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = minusFront([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(7500, 1);
  });

  it("exclude keeps non-overlapping regions", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = exclude([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(15000, 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** (append to `pathfinder.ts`):

```ts
function reduceBoolean(
  items: PItem[],
  op: (a: PItem, b: PItem) => PItem
): PItem[] {
  const work = cloneItems(items);
  if (work.length === 0) return [];
  let acc = work[0];
  for (let i = 1; i < work.length; i++) {
    acc = op(acc, work[i]);
  }
  return [acc];
}

export function unite(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.unite(b));
}

export function intersect(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.intersect(b));
}

// Illustrator "Minus Front": back-most minus everything in front.
export function minusFront(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.subtract(b));
}

export function exclude(items: PItem[]): PItem[] {
  return reduceBoolean(items, (a, b) => a.exclude(b));
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder shape modes (unite/intersect/minusFront/exclude)`.

---

### Task 3: Minus Back

**Files:** Modify `pathfinder.ts`; add test.

**Interfaces (Produces):** `minusBack(items: PItem[]): PItem[]` — front-most minus everything behind it.

- [ ] **Step 1: Add failing test**

```ts
import { minusBack } from "../pathfinder";

describe("pathfinder minus back", () => {
  it("subtracts back objects from the front object", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc); // A back, B front
    const out = minusBack([A, B]);
    // B (front, area 10000) minus A overlap (2500) = 7500
    expect(Math.abs(out[0].area)).toBeCloseTo(7500, 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**:

```ts
export function minusBack(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  if (work.length === 0) return [];
  let acc = work[work.length - 1]; // front-most
  for (let i = work.length - 2; i >= 0; i--) {
    acc = acc.subtract(work[i]);
  }
  return [acc];
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder minusBack`.

---

### Task 4: Divide

**Files:** Modify `pathfinder.ts`; add tests.

**Interfaces (Produces):** `divide(items: PItem[]): PItem[]` — every distinct region bounded by any input edge becomes its own path. For two overlapping squares → 3 faces: A-only, overlap, B-only.

Algorithm: For each input item, subtract the union of all OTHER items to get its exclusive region(s), and separately compute the pairwise intersections (the shared region belongs to the front item's fill in Illustrator, but as a divided face it is one region). Concretely, produce:
- For each item i: `item_i - unionOfOthers` → exclusive faces.
- The full set of intersection faces: the union of all pairwise intersections, divided so each maximal overlap is one face. For the 2-item case this is simply `A ∩ B`.

For v0 correctness on the common (≤ a few overlapping shapes) case, implement Divide as: collect exclusive regions for every item + the intersection regions computed by repeatedly intersecting. Test asserts total area is conserved and piece count for the canonical 2-square case is 3.

- [ ] **Step 1: Add failing tests**

```ts
import { divide } from "../pathfinder";

describe("pathfinder divide", () => {
  it("splits two overlapping squares into 3 faces conserving area", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = divide([A, B]);
    const nonEmpty = out.filter((p) => Math.abs(p.area) > 1e-6);
    expect(nonEmpty.length).toBe(3);
    // A-only 7500 + overlap 2500 + B-only 7500 = 17500 (union)
    expect(nonEmpty.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(17500, 1);
  });

  it("returns non-overlapping shapes unchanged (2 faces)", () => {
    const doc = createDocument(400, 400);
    const s = doc.scope;
    const A = new s.Path.Rectangle({ point: [0, 0], size: [40, 40] }) as unknown as import("paper").PathItem;
    const B = new s.Path.Rectangle({ point: [100, 100], size: [40, 40] }) as unknown as import("paper").PathItem;
    const out = divide([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    expect(out.length).toBe(2);
    expect(out.reduce((sum, p) => sum + Math.abs(p.area), 0)).toBeCloseTo(3200, 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**:

```ts
function unionOf(items: PItem[]): PItem | null {
  if (items.length === 0) return null;
  let acc = items[0].clone({ insert: false }) as PItem;
  for (let i = 1; i < items.length; i++) {
    acc = acc.unite(items[i]);
  }
  return acc;
}

export function divide(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  const faces: PItem[] = [];

  // Exclusive region of each item (item minus union of all others).
  for (let i = 0; i < work.length; i++) {
    const others = work.filter((_, j) => j !== i);
    const u = unionOf(others);
    const exclusive = u ? work[i].subtract(u) : (work[i].clone({ insert: false }) as PItem);
    if (Math.abs(exclusive.area) > 1e-6) faces.push(exclusive);
  }

  // Pairwise intersection faces (each unordered pair once).
  for (let i = 0; i < work.length; i++) {
    for (let j = i + 1; j < work.length; j++) {
      const inter = work[i].intersect(work[j]);
      if (Math.abs(inter.area) > 1e-6) faces.push(inter);
    }
  }

  return faces;
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder divide`.

---

### Task 5: Trim & Merge

**Files:** Modify `pathfinder.ts`; add tests.

**Interfaces (Produces):**
- `trim(items: PItem[]): PItem[]` — removes the hidden part of each item (the part covered by any item in front of it); keeps fills, does not merge same-colored.
- `merge(items: PItem[]): PItem[]` — Trim, then unite adjacent same-fill-color items.

Trim algorithm: for each item i (0=back), subtract the union of all items in FRONT of it (indices > i). Frontmost item is unchanged.

- [ ] **Step 1: Add failing tests**

```ts
import { trim, merge } from "../pathfinder";

describe("pathfinder trim", () => {
  it("clips back shapes by the ones in front; area = union", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = trim([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    // A clipped by B (7500) + B untouched (10000) = 17500
    expect(out.length).toBe(2);
    expect(out.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(17500, 1);
  });
});

describe("pathfinder merge", () => {
  it("unites same-colored adjacent regions after trimming", () => {
    const doc = createDocument(400, 400);
    const s = doc.scope;
    const A = new s.Path.Rectangle({ point: [0, 0], size: [100, 100] });
    const B = new s.Path.Rectangle({ point: [50, 0], size: [100, 100] });
    const same = new s.Color(1, 0, 0);
    A.fillColor = same; B.fillColor = same;
    const out = merge([A as import("paper").PathItem, B as import("paper").PathItem]);
    // Same color, touching → single merged piece of union area 15000.
    expect(out.length).toBe(1);
    expect(Math.abs(out[0].area)).toBeCloseTo(15000, 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**:

```ts
export function trim(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  const out: PItem[] = [];
  for (let i = 0; i < work.length; i++) {
    const inFront = work.slice(i + 1);
    const u = unionOf(inFront);
    const clipped = u ? work[i].subtract(u) : work[i];
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
        const united = acc.unite(trimmed[j]);
        // Only merge if they actually touch (area of union < sum implies overlap;
        // for adjacency Paper still unites into one path with a single child).
        acc = united;
        used[j] = true;
      }
    }
    used[i] = true;
    out.push(acc);
  }
  return out;
}
```

- [ ] **Step 2 note:** If the merge test shows 2 pieces because the squares only touch at an edge (no overlap), adjust the test fixture so B overlaps A (`point: [50, 0]` gives a 50-wide overlap) — the fixture above already overlaps, so union = 15000 and merge yields one piece.

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder trim + merge`.

---

### Task 6: Crop & Outline

**Files:** Modify `pathfinder.ts`; add tests.

**Interfaces (Produces):**
- `crop(items: PItem[]): PItem[]` — keep only the parts of all items that lie inside the FRONT-most (topmost) item; the crop shape itself is consumed.
- `outline(items: PItem[]): PItem[]` — convert filled regions to their outline strokes: return the boundary of each divided face as an open/closed unfilled stroked path (area ≈ 0, non-zero length).

Crop algorithm: intersect every item BELOW the top with the top item; discard the top shape.

Outline algorithm: run `divide`, then for each face set fillColor=null, strokeColor=black, strokeWidth=1 (the face boundary becomes a stroke). Assert each result has length > 0.

- [ ] **Step 1: Add failing tests**

```ts
import { crop, outline } from "../pathfinder";

describe("pathfinder crop", () => {
  it("keeps only what is inside the top shape", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc); // B is top
    const out = crop([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    // A ∩ B = 2500; B consumed as the crop frame.
    expect(out.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(2500, 1);
  });
});

describe("pathfinder outline", () => {
  it("produces stroked, (near) zero-area paths with length", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = outline([A, B]).filter((p) => p.length > 1e-6);
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(Math.abs(p.area)).toBeCloseTo(0, 6);
      expect(p.strokeColor).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**:

```ts
export function crop(items: PItem[]): PItem[] {
  const work = cloneItems(items);
  if (work.length < 2) return work;
  const top = work[work.length - 1];
  const out: PItem[] = [];
  for (let i = 0; i < work.length - 1; i++) {
    const inside = work[i].intersect(top);
    if (Math.abs(inside.area) > 1e-6) out.push(inside);
  }
  return out;
}

export function outline(items: PItem[]): PItem[] {
  const faces = divide(items);
  for (const f of faces) {
    f.fillColor = null;
    f.strokeColor = new (f.view?.constructor ? f : f).strokeColor?.constructor
      ? f.strokeColor!
      : f.strokeColor!;
  }
  // Set stroke explicitly using the item's project scope.
  return faces.map((f) => {
    f.fillColor = null;
    f.strokeWidth = 1;
    // Use black stroke; access Color via the item's className-safe constructor.
    (f as unknown as { strokeColor: unknown }).strokeColor = makeBlack(f);
    return f;
  });
}
```

Because constructing a `Color` needs a scope, add a helper that reads the item's project:

```ts
function makeBlack(item: PItem): paper.Color {
  // paper.Item exposes `.project` whose scope provides the Color constructor.
  const scope = (item.project as unknown as { _scope?: paper.PaperScope })._scope
    ?? (item as unknown as { _project: { _scope: paper.PaperScope } })._project._scope;
  return new scope.Color(0, 0, 0);
}
```

- [ ] **Step 3b (simplify):** If accessing `_scope` is brittle, instead import `paper` directly in `pathfinder.ts` and use `new paper.Color(0,0,0)` — under test this resolves to `paper-jsdom`'s Color via the alias, and in the browser to the global. Replace `makeBlack` with `new paper.Color(0, 0, 0)` and drop the helper. Prefer this simpler form.

Final `outline`:

```ts
import paper from "paper";
// ...
export function outline(items: PItem[]): PItem[] {
  const faces = divide(items);
  return faces.map((f) => {
    f.fillColor = null;
    f.strokeColor = new paper.Color(0, 0, 0);
    f.strokeWidth = 1;
    return f;
  });
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder crop + outline`.

---

### Task 7: Public op registry

**Files:** Modify `pathfinder.ts`; add test.

**Interfaces (Produces):**
- `type PathfinderOp = "unite" | "minusFront" | "intersect" | "exclude" | "divide" | "trim" | "merge" | "crop" | "outline" | "minusBack";`
- `const PATHFINDER_OPS: { id: PathfinderOp; label: string; run(items: PItem[]): PItem[] }[]`
- `function applyPathfinder(op: PathfinderOp, items: PItem[]): PItem[]`

- [ ] **Step 1: Add failing test**

```ts
import { PATHFINDER_OPS, applyPathfinder } from "../pathfinder";

describe("pathfinder registry", () => {
  it("exposes all 10 operations", () => {
    expect(PATHFINDER_OPS.map((o) => o.id).sort()).toEqual(
      ["crop","divide","exclude","intersect","merge","minusBack","minusFront","outline","trim","unite"]
    );
  });
  it("applyPathfinder dispatches by id", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = applyPathfinder("unite", [A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(17500, 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**:

```ts
export type PathfinderOp =
  | "unite" | "minusFront" | "intersect" | "exclude"
  | "divide" | "trim" | "merge" | "crop" | "outline" | "minusBack";

export const PATHFINDER_OPS: { id: PathfinderOp; label: string; run(items: PItem[]): PItem[] }[] = [
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
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: pathfinder op registry + dispatch`.

---

### Task 8: Selection tool (V) — needed to pick shapes for Pathfinder

**Files:**
- Create: `src/tools/select.ts`, `src/tools/__tests__/select.test.ts`

**Interfaces (Produces):**
- `class SelectTool { constructor(doc); pointerDown(p, m?); pointerDrag(p, m?); pointerUp(p, m?); get selection(): paper.Item[]; selectAll(): void; clear(): void; deleteSelection(): void; }`
- Click selects the topmost item under the cursor (shift adds/removes). Empty click clears. Marquee drag selects intersecting items. Selected items get `.selected = true`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createDocument, addRectangle } from "@/engine/document";
import { SelectTool } from "../select";

describe("SelectTool", () => {
  it("click selects the item under the cursor", () => {
    const doc = createDocument(400, 400);
    addRectangle(doc, 10, 10, 80, 80);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 40, y: 40 }); sel.pointerUp({ x: 40, y: 40 });
    expect(sel.selection.length).toBe(1);
  });

  it("empty click clears selection", () => {
    const doc = createDocument(400, 400);
    addRectangle(doc, 10, 10, 80, 80);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 40, y: 40 }); sel.pointerUp({ x: 40, y: 40 });
    sel.pointerDown({ x: 300, y: 300 }); sel.pointerUp({ x: 300, y: 300 });
    expect(sel.selection.length).toBe(0);
  });

  it("shift-click adds a second item", () => {
    const doc = createDocument(400, 400);
    addRectangle(doc, 10, 10, 40, 40);
    addRectangle(doc, 100, 100, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 20, y: 20 }); sel.pointerUp({ x: 20, y: 20 });
    sel.pointerDown({ x: 110, y: 110 }, { shift: true }); sel.pointerUp({ x: 110, y: 110 }, { shift: true });
    expect(sel.selection.length).toBe(2);
  });

  it("marquee drag selects intersecting items", () => {
    const doc = createDocument(400, 400);
    addRectangle(doc, 10, 10, 40, 40);
    addRectangle(doc, 100, 100, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 0, y: 0 });
    sel.pointerDrag({ x: 160, y: 160 });
    sel.pointerUp({ x: 160, y: 160 });
    expect(sel.selection.length).toBe(2);
  });

  it("deleteSelection removes selected items", () => {
    const doc = createDocument(400, 400);
    addRectangle(doc, 10, 10, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 20, y: 20 }); sel.pointerUp({ x: 20, y: 20 });
    sel.deleteSelection();
    expect(doc.project.activeLayer.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/tools/select.ts`:

```ts
import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";

export class SelectTool {
  private doc: EditorDoc;
  private downPoint: Vec | null = null;
  private marquee: paper.Path | null = null;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get selection(): paper.Item[] {
    return this.doc.project.selectedItems as paper.Item[];
  }

  clear(): void {
    this.doc.project.deselectAll();
  }

  selectAll(): void {
    this.doc.project.activeLayer.children.forEach((c) => (c.selected = true));
  }

  deleteSelection(): void {
    [...this.selection].forEach((it) => it.remove());
  }

  pointerDown(p: Vec, m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.downPoint = { x: p.x, y: p.y };
    const hit = this.doc.project.hitTest(this.pt(p), {
      fill: true,
      stroke: true,
      segments: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.item) {
      if (!m.shift) this.clear();
      hit.item.selected = !m.shift ? true : !hit.item.selected;
    } else if (!m.shift) {
      this.clear();
    }
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.downPoint) return;
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({
      from: this.pt(this.downPoint),
      to: this.pt(p),
    });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.strokeWidth = 1;
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.marquee && this.downPoint) {
      const rect = new this.doc.scope.Rectangle(this.pt(this.downPoint), this.pt(p));
      this.doc.project.activeLayer.children.forEach((child) => {
        if (child === this.marquee) return;
        if (child.bounds.intersects(rect)) child.selected = true;
      });
      this.marquee.remove();
      this.marquee = null;
    }
    this.downPoint = null;
  }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: Selection tool (click/shift/marquee/delete)`.

---

### Task 9: Pathfinder panel + Select tool wiring

**Files:**
- Create: `src/components/PathfinderPanel.tsx`
- Modify: `src/tools/useActiveTool.ts` (route events to Select tool when active; expose a way to run a pathfinder op on the selection and replace it)
- Modify: `src/components/EditorShell.tsx` (render the panel)

This is browser glue — verified manually + with a Playwright screenshot.

- [ ] **Step 1:** Extend `installTools` to also construct a `SelectTool`, route pointer/marquee events to it when `activeTool === "select"`, and expose a controller on the returned object:

Change `installTools` to return `{ teardown, runPathfinder }` where `runPathfinder(op)` reads `select.selection` (filtered to PathItems), calls `applyPathfinder`, removes the originals, inserts the results (selected), and updates the view. Full code:

```ts
import { applyPathfinder, type PathfinderOp, type PItem } from "@/engine/pathfinder";
import { SelectTool } from "./select";

export interface ToolController {
  teardown: () => void;
  runPathfinder: (op: PathfinderOp) => void;
}

export function installTools(doc: EditorDoc): ToolController {
  // ... existing pen setup ...
  const select = new SelectTool(doc);

  const active = () => editorStore.getState().activeTool;

  tool.onMouseDown = (e) => {
    if (active() === "pen") { pen.pointerDown(vec(e.point), mods(e)); drawPreview(); }
    else if (active() === "select") { select.pointerDown(vec(e.point), mods(e)); doc.scope.view.update(); editorStore.getState().setSelectionCount(select.selection.length); }
  };
  tool.onMouseDrag = (e) => {
    if (active() === "pen") { pen.pointerDrag(vec(e.point), mods(e)); doc.scope.view.update(); }
    else if (active() === "select") { select.pointerDrag(vec(e.point), mods(e)); doc.scope.view.update(); }
  };
  tool.onMouseUp = (e) => {
    if (active() === "pen") { pen.pointerUp(vec(e.point), mods(e)); }
    else if (active() === "select") { select.pointerUp(vec(e.point), mods(e)); doc.scope.view.update(); editorStore.getState().setSelectionCount(select.selection.length); }
  };
  tool.onMouseMove = (e) => {
    if (active() === "pen") { pen.pointerMove(vec(e.point), mods(e)); drawPreview(); }
  };

  function runPathfinder(op: PathfinderOp) {
    const items = select.selection.filter(
      (it) => typeof (it as unknown as PItem).unite === "function"
    ) as unknown as PItem[];
    if (items.length < 1) return;
    const result = applyPathfinder(op, items);
    items.forEach((it) => (it as unknown as paper.Item).remove());
    result.forEach((r) => {
      doc.project.activeLayer.addChild(r as unknown as paper.Item);
      (r as unknown as paper.Item).selected = true;
    });
    doc.scope.view.update();
    editorStore.getState().setSelectionCount(result.length);
  }

  tool.activate();
  return { teardown: () => { if (overlay) overlay.remove(); tool.remove(); }, runPathfinder };
}
```

- [ ] **Step 2:** Store the controller so the panel can call it. Add to the store: `controller: ToolController | null; setController(c): void;`. Update `ArtboardCanvas` to `editorStore.getState().setController(installTools(doc))` and clear on teardown.

Add to `src/state/store.ts`:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
controller: any | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
setController(c: any | null): void;
```
with defaults `controller: null` and `setController: (c) => set({ controller: c })`.

- [ ] **Step 3:** Create `src/components/PathfinderPanel.tsx`:

```tsx
"use client";

import { editorStore, useEditorStore } from "@/state/store";
import { PATHFINDER_OPS } from "@/engine/pathfinder";

export function PathfinderPanel() {
  const count = useEditorStore((s) => s.selectionCount);
  return (
    <div className="panel">
      <div className="panel-title">Pathfinder</div>
      <div className="panel-hint">{count} selected</div>
      <div className="pf-grid">
        {PATHFINDER_OPS.map((op) => (
          <button
            key={op.id}
            className="pf-btn"
            disabled={count < 1}
            onClick={() => editorStore.getState().controller?.runPathfinder(op.id)}
            title={op.label}
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4:** Render the panel in `EditorShell` (right rail) and add CSS (`.panel`, `.pf-grid`, `.pf-btn`) to `globals.css`. Update the `.editor` grid to `grid-template-columns: 160px 1fr 200px`.

- [ ] **Step 5:** `npm run build`; then Playwright verify: draw/добавить two overlapping rects (or use Select on demo content), select both, click "Unite", screenshot shows a single merged shape.

- [ ] **Step 6: Commit** — `feat: Pathfinder panel wired to selection + Select tool`.

---

## Self-Review

**Spec coverage (Pathfinder section):**
- Unite/Minus Front/Intersect/Exclude → Task 2. ✓
- Divide/Trim/Merge/Crop/Outline → Tasks 4–6. ✓
- Minus Back → Task 3. ✓ (all 10 → Task 7 registry asserts exactly 10)
- Multi-select to feed Pathfinder → Task 8 Select tool. ✓
- Panel UI → Task 9. ✓

**Placeholder scan:** Task 6 outline had an over-complex draft; the plan resolves it to the simple `new paper.Color(0,0,0)` form (Step 3b) — use that. No other placeholders.

**Type consistency:** `PItem` defined once; every op has signature `(items: PItem[]) => PItem[]`; registry + `applyPathfinder` reuse `PathfinderOp`. `ToolController` shared between `useActiveTool` and store. ✓

**Risk note:** Divide/Trim/Merge correctness beyond the 2–3 shape case isn't exhaustively tested; the canonical overlapping-squares cases are covered and conserve area. If a real multi-shape case misbehaves, add a targeted test and refine — do not silently accept wrong geometry.
