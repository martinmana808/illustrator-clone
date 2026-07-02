# Pen & Anchor Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Illustrator-grade point editing: an Anchor Point (convert) tool, visible anchor squares + direction handles, double-click-into-Direct-Select, a real curved rubber-band preview, and context-sensitive Pen nib cursors.

**Architecture:** Add a headless `AnchorPointTool` state machine and a pure `penCursors` map. Extend the centralized overlay system in `useActiveTool.ts` to draw Illustrator-style anchors/handles and a curved pen preview, to set the canvas cursor from the Pen's hover state, and to enter Direct Select on double-click. Paper's default selection drawing is disabled (`settings.handleSize = 0`) so our overlay owns the look.

**Tech Stack:** Paper.js, TypeScript, Vitest.

## Global Constraints

- Tools render nothing; they mutate the Paper doc and expose state. Overlays live only in `useActiveTool.ts` and are stripped before every history capture/export/save (existing system).
- Reuse `src/engine/anchors.ts` (`setSymmetricHandles`, `makeCorner`, `isSmooth`).
- New tool id: `"anchor-point"`; shortcut Shift+C.
- Hit tolerance `HIT_TOLERANCE` (6).

---

### Task 1: AnchorPointTool state machine

**Files:**
- Create: `src/tools/anchorPoint.ts`, `src/tools/__tests__/anchorPoint.test.ts`

**Interfaces (Produces):**
- `class AnchorPointTool { constructor(doc: EditorDoc); pointerDown(p: Vec, m?: Modifiers): void; pointerDrag(p: Vec, m?: Modifiers): void; pointerUp(p: Vec, m?: Modifiers): void; }`

Behavior:
- pointerDown on a **handle** (handle-in/out) → drag that handle only (break symmetry).
- pointerDown on an **anchor** → record it; drag pulls symmetric handles; click (no drag) collapses a smooth anchor to a corner.

- [ ] **Step 1: Write failing tests** — `src/tools/__tests__/anchorPoint.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { AnchorPointTool } from "../anchorPoint";

function smoothPath(doc: ReturnType<typeof createDocument>) {
  const s = doc.scope;
  const p = new s.Path();
  p.strokeColor = new s.Color(0, 0, 0);
  const seg = p.add(new s.Point(100, 100)) as unknown as paper.Segment;
  seg.handleOut = new s.Point(20, 0);
  seg.handleIn = new s.Point(-20, 0);
  p.add(new s.Point(200, 100));
  return p as unknown as paper.Path;
}

describe("AnchorPointTool", () => {
  it("drag on a corner anchor pulls out symmetric handles", () => {
    const doc = createDocument(300, 300);
    const s = doc.scope;
    const path = new s.Path() as unknown as paper.Path;
    path.strokeColor = new s.Color(0, 0, 0);
    path.add(new s.Point(50, 50));
    path.add(new s.Point(150, 50));
    const tool = new AnchorPointTool(doc);
    tool.pointerDown({ x: 50, y: 50 });
    tool.pointerDrag({ x: 60, y: 50 });
    tool.pointerUp({ x: 60, y: 50 });
    expect(path.segments[0].handleOut.length).toBeGreaterThan(1);
    expect(path.segments[0].handleIn.length).toBeGreaterThan(1);
  });

  it("click (no drag) on a smooth anchor collapses it to a corner", () => {
    const doc = createDocument(300, 300);
    const path = smoothPath(doc);
    const tool = new AnchorPointTool(doc);
    tool.pointerDown({ x: 100, y: 100 });
    tool.pointerUp({ x: 100, y: 100 });
    expect(path.segments[0].handleIn.length).toBeCloseTo(0, 4);
    expect(path.segments[0].handleOut.length).toBeCloseTo(0, 4);
  });

  it("dragging one handle breaks symmetry (only that handle moves)", () => {
    const doc = createDocument(300, 300);
    const path = smoothPath(doc); // seg0 handleOut=(20,0), handleIn=(-20,0)
    const tool = new AnchorPointTool(doc);
    // handleOut world position = point + handleOut = (120,100); drag to (120,140)
    tool.pointerDown({ x: 120, y: 100 });
    tool.pointerDrag({ x: 120, y: 140 });
    tool.pointerUp({ x: 120, y: 140 });
    expect(path.segments[0].handleOut.y).toBeCloseTo(40, 1);
    expect(path.segments[0].handleIn.y).toBeCloseTo(0, 1); // unchanged
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npm test -- anchorPoint`).

- [ ] **Step 3: Implement** `src/tools/anchorPoint.ts`:

```ts
import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { setSymmetricHandles, makeCorner } from "@/engine/anchors";

type Kind = "anchor" | "handleIn" | "handleOut" | null;

export class AnchorPointTool {
  private doc: EditorDoc;
  private seg: paper.Segment | null = null;
  private kind: Kind = null;
  private downPoint: Vec | null = null;
  private didDrag = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.seg = null;
    this.kind = null;
    this.didDrag = false;
    this.downPoint = { x: p.x, y: p.y };
    const hit = this.doc.project.hitTest(this.pt(p), {
      segments: true,
      handles: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.segment) {
      this.seg = hit.segment;
      this.kind =
        hit.type === "handle-in" ? "handleIn" : hit.type === "handle-out" ? "handleOut" : "anchor";
    }
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.seg || !this.downPoint) return;
    this.didDrag = true;
    const seg = this.seg;
    if (this.kind === "anchor") {
      const dx = p.x - this.downPoint.x;
      const dy = p.y - this.downPoint.y;
      setSymmetricHandles(seg, { x: dx, y: dy });
    } else if (this.kind === "handleOut") {
      seg.handleOut = this.pt(p).subtract(seg.point);
    } else if (this.kind === "handleIn") {
      seg.handleIn = this.pt(p).subtract(seg.point);
    }
  }

  pointerUp(_p: Vec, _m: Modifiers = {}): void {
    if (this.seg && this.kind === "anchor" && !this.didDrag) {
      makeCorner(this.seg); // click a smooth point → collapse to corner
    }
    this.seg = null;
    this.kind = null;
    this.downPoint = null;
    this.didDrag = false;
  }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: Anchor Point (convert) tool state machine`.

---

### Task 2: Pen cursor map (pure)

**Files:**
- Create: `src/tools/penCursors.ts`, `src/tools/__tests__/penCursors.test.ts`

**Interfaces (Produces):**
- `interface CursorSpec { url: string; hotspot: [number, number]; }`
- `const PEN_CURSORS: Record<PenCursor, CursorSpec>`
- `cursorCss(c: PenCursor): string` → `url("data:...") x y, crosshair`

- [ ] **Step 1: Write failing test** — `src/tools/__tests__/penCursors.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { PEN_CURSORS, cursorCss } from "../penCursors";
import type { PenCursor } from "../types";

const STATES: PenCursor[] = ["pen", "add", "delete", "close", "corner", "continue"];

describe("pen cursors", () => {
  it("defines a cursor for every PenCursor state", () => {
    for (const s of STATES) {
      expect(PEN_CURSORS[s]).toBeTruthy();
      expect(PEN_CURSORS[s].url).toContain("data:image/svg+xml");
      expect(PEN_CURSORS[s].hotspot.length).toBe(2);
    }
  });

  it("cursorCss produces a valid CSS cursor value with hotspot + fallback", () => {
    const css = cursorCss("add");
    expect(css).toMatch(/^url\("data:image\/svg\+xml/);
    expect(css).toMatch(/\d+ \d+, (crosshair|auto)$/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/tools/penCursors.ts`. Each cursor is a 24×24 SVG of a pen nib plus a modifier glyph; hotspot at the nib tip (2,2). Encode via `encodeURIComponent`.

```ts
import type { PenCursor } from "./types";

export interface CursorSpec {
  url: string;
  hotspot: [number, number];
}

// A pen-nib path with its tip at (2,2); modifier glyph drawn at top-right.
function nib(modifier: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<path d="M2 2 L10 5 L5 10 Z" fill="#000" stroke="#fff" stroke-width="1"/>
<path d="M6 9 L14 17" stroke="#000" stroke-width="1.5"/>
${modifier}
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const GLYPH = {
  none: "",
  star: `<text x="16" y="10" font-size="10" fill="#000">✳</text>`,
  plus: `<path d="M16 4 h6 M19 1 v6" stroke="#000" stroke-width="1.5"/>`,
  minus: `<path d="M16 4 h6" stroke="#000" stroke-width="1.5"/>`,
  circle: `<circle cx="19" cy="5" r="3" fill="none" stroke="#000" stroke-width="1.5"/>`,
  caret: `<path d="M15 7 l3 -4 l3 4" fill="none" stroke="#000" stroke-width="1.5"/>`,
};

export const PEN_CURSORS: Record<PenCursor, CursorSpec> = {
  pen: { url: nib(GLYPH.none), hotspot: [2, 2] },
  continue: { url: nib(GLYPH.star), hotspot: [2, 2] },
  add: { url: nib(GLYPH.plus), hotspot: [2, 2] },
  delete: { url: nib(GLYPH.minus), hotspot: [2, 2] },
  close: { url: nib(GLYPH.circle), hotspot: [2, 2] },
  corner: { url: nib(GLYPH.caret), hotspot: [2, 2] },
};

export function cursorCss(c: PenCursor): string {
  const spec = PEN_CURSORS[c] ?? PEN_CURSORS.pen;
  return `url("${spec.url}") ${spec.hotspot[0]} ${spec.hotspot[1]}, crosshair`;
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: Illustrator-style pen cursor map`.

---

### Task 3: Register the Anchor Point tool (store, toolbar, routing, shortcut)

**Files:**
- Modify: `src/state/store.ts`, `src/components/Toolbar.tsx`, `src/tools/useActiveTool.ts`, `src/components/ArtboardCanvas.tsx`

**Interfaces (Consumes):** `AnchorPointTool` (Task 1).

- [ ] **Step 1:** In `src/state/store.ts` extend the union:

```ts
export type ToolId = "select" | "direct-select" | "pen" | "type" | "type-on-path" | "anchor-point";
```

- [ ] **Step 2:** In `src/components/Toolbar.tsx` add to `TOOLS` (after direct-select):

```ts
  { id: "anchor-point", label: "Anchor Point", key: "Shift+C" },
```

- [ ] **Step 3:** In `src/tools/useActiveTool.ts`, import and construct the tool near the others:

```ts
import { AnchorPointTool } from "./anchorPoint";
// ...
  const anchorPoint = new AnchorPointTool(doc);
```

Then route it in `onMouseDown`/`onMouseDrag`/`onMouseUp` (add an `else if` branch in each, mirroring `direct-select`, and `commit()` on up):

```ts
// onMouseDown (after the direct-select branch, before type):
    } else if (active() === "anchor-point") {
      anchorPoint.pointerDown(vec(e.point), mods(e));
      drawOverlays();
    }
// onMouseDrag:
    } else if (active() === "anchor-point") {
      anchorPoint.pointerDrag(vec(e.point), mods(e));
    }
// onMouseUp:
    } else if (active() === "anchor-point") {
      anchorPoint.pointerUp(vec(e.point), mods(e));
      commit();
    }
```

(`drawOverlays()` is already called at the end of each handler.)

- [ ] **Step 4:** In `src/components/ArtboardCanvas.tsx` add the Shift+C shortcut inside the non-typing branch of the key handler (next to v/a/p/t):

```ts
      if (k === "c" && e.shiftKey) {
        editorStore.getState().setTool("anchor-point");
        return;
      }
```
(Place this before the single-letter checks; guard `!e.metaKey && !e.ctrlKey` already applies.)

- [ ] **Step 5:** Build to verify wiring: `npm run build` → succeeds.
- [ ] **Step 6: Commit** — `feat: register Anchor Point tool (toolbar + Shift+C + routing)`.

---

### Task 4: Illustrator-style anchor/handle overlay + curved pen preview + cursors + double-click

**Files:**
- Modify: `src/tools/useActiveTool.ts`

This is browser-facing rendering/interaction glue — verified manually + Playwright. All additions live in the overlay system, so they never serialize.

- [ ] **Step 1: Disable Paper's default selection drawing.** In `installTools`, right after `scope.activate();`:

```ts
  scope.settings.handleSize = 0; // our overlay owns anchor/handle rendering
```

- [ ] **Step 2: Draw the anchor/handle overlay.** Add a helper and call it from `drawOverlays()` for the `direct-select` and `anchor-point` tools. Insert this function above `drawOverlays`:

```ts
  function drawAnchorOverlay() {
    const layer = scope.project.activeLayer;
    const blue = new scope.Color(0.15, 0.5, 0.9);
    for (const item of layer.children) {
      const path = item as paper.Path;
      if (!path.segments) continue;
      const anySel = path.selected || path.segments.some((s) => s.selected);
      if (!anySel) continue;
      for (const seg of path.segments) {
        // Direction handles for selected anchors.
        if (seg.selected) {
          for (const h of [seg.handleIn, seg.handleOut]) {
            if (h.length < 0.01) continue;
            const end = seg.point.add(h);
            const line = new scope.Path.Line(seg.point, end);
            line.strokeColor = blue;
            line.strokeWidth = 1;
            overlays.push(line);
            const dot = new scope.Path.Circle(end, 2.5);
            dot.fillColor = blue;
            overlays.push(dot);
          }
        }
        // Anchor square: filled if selected, hollow otherwise.
        const sq = new scope.Path.Rectangle({
          point: [seg.point.x - 3, seg.point.y - 3],
          size: [6, 6],
        });
        if (seg.selected) {
          sq.fillColor = blue;
        } else {
          sq.fillColor = new scope.Color(1, 1, 1);
          sq.strokeColor = blue;
          sq.strokeWidth = 1;
        }
        overlays.push(sq);
      }
    }
  }
```

Then in `drawOverlays()`, add near the top (after `stripOverlays()`), and before the type early-return:

```ts
    if (active() === "direct-select" || active() === "anchor-point") {
      drawAnchorOverlay();
      scope.view.update();
      return;
    }
```

- [ ] **Step 3: Curved rubber-band preview.** Replace the pen preview construction in `drawOverlays()` (the `active() === "pen"` branch) so it uses the last anchor's outgoing handle:

```ts
    if (active() === "pen") {
      const p = pen.previewPoint;
      const path = pen.currentPath;
      if (p && path && path.lastSegment) {
        const last = path.lastSegment;
        const seg0 = new scope.Segment(last.point, last.handleIn, last.handleOut);
        const seg1 = new scope.Segment(new scope.Point(p.x, p.y));
        const preview = new scope.Path([seg0, seg1]);
        preview.strokeColor = new scope.Color(0.4, 0.4, 0.9);
        preview.dashArray = [4, 4];
        overlays.push(preview);
      }
    }
```

- [ ] **Step 4: Set the Pen cursor from hover state.** Import the cursor helper and update the cursor on pen mouse-move. At top of file:

```ts
import { cursorCss } from "./penCursors";
```

In `tool.onMouseMove`, in the pen branch, after `pen.pointerMove(...)`:

```ts
      const el = scope.view.element as HTMLCanvasElement | undefined;
      if (el) el.style.cursor = cursorCss(pen.hoverCursor(vec(e.point), mods(e)));
```

Also reset the cursor when leaving pen: in the tool-change subscription (`unsubTool`), when the new tool is not `"pen"`, clear it:

```ts
      const el = scope.view.element as HTMLCanvasElement | undefined;
      if (el) el.style.cursor = t === "pen" ? cursorCss("pen") : "default";
```

- [ ] **Step 5: Double-click a path → Direct Select.** After `tool.activate();`, add a DOM double-click handler and unbind it in teardown:

```ts
  const el = scope.view.element as HTMLCanvasElement | undefined;
  const onDblClick = (ev: MouseEvent) => {
    if (editorStore.getState().activeTool !== "select" || !el) return;
    const rect = el.getBoundingClientRect();
    const pt = new scope.Point(ev.clientX - rect.left, ev.clientY - rect.top);
    const hit = scope.project.hitTest(pt, { fill: true, stroke: true, tolerance: HIT_TOLERANCE });
    if (hit && hit.item) {
      scope.project.deselectAll();
      (hit.item as paper.Path).fullySelected = true;
      editorStore.getState().setTool("direct-select");
      editorStore.getState().setSelectionCount(1);
      drawOverlays();
    }
  };
  el?.addEventListener("dblclick", onDblClick);
```

Add `HIT_TOLERANCE` import if not present:
```ts
import { HIT_TOLERANCE } from "./constants";
```
In `teardown`, before `tool.remove()`:
```ts
      el?.removeEventListener("dblclick", onDblClick);
```

- [ ] **Step 6:** `npm run build` → succeeds; `npm test` → all pass (no unit regressions).

- [ ] **Step 7: Browser-verify** with Playwright: draw a curved path (see curved dashed preview + nib+ cursor states), switch to Direct Select (anchors as squares, handles on selected), use Anchor Point tool to pull handles from a corner and to click-collapse a smooth point, and double-click a path with the Selection tool to drop into Direct Select. Screenshot each.

- [ ] **Step 8: Commit** — `feat: anchor/handle overlay, curved pen preview, nib cursors, dblclick-to-direct-select`.

---

## Self-Review

**Spec coverage:**
- Anchor Point tool (pull / remove / break) → Task 1. ✓
- Register tool + Shift+C → Task 3. ✓
- Anchor squares + handles (Illustrator defaults, `handleSize=0`) → Task 4 (Steps 1–2). ✓
- Curved rubber-band → Task 4 (Step 3). ✓
- Pen nib cursors → Tasks 2 + 4 (Step 4). ✓
- Double-click → Direct Select → Task 4 (Step 5). ✓

**Placeholder scan:** none — full code in every step.

**Type consistency:** `AnchorPointTool` signature stable; `PenCursor` union reused from `types.ts`; `cursorCss`/`PEN_CURSORS` names consistent; new `ToolId` member `"anchor-point"` used identically across store/toolbar/routing.
