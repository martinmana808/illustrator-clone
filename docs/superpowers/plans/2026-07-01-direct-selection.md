# Direct Selection Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The Direct Selection tool (A): select and drag individual anchors and bezier handles of existing paths, with smooth-point handle mirroring (Alt breaks the pair), path-level selection by clicking the stroke, and marquee anchor selection.

**Architecture:** A headless `DirectSelectTool` state machine (like Pen/Select) mutates `paper.Segment` points/handles. Wired into `installTools` under the existing `direct-select` tool id. Reuses `isSmooth`/`setSymmetricHandles` from `src/engine/anchors.ts`.

**Tech Stack:** Paper.js, TypeScript, Vitest.

## Global Constraints

- Tools render nothing; mutate the Paper doc and expose state for tests/UI.
- Handle mirroring uses `isSmooth`; Alt breaks the link (independent handles).
- Hit tolerance `HIT_TOLERANCE`.

---

### Task 1: DirectSelectTool — select & drag anchors

**Files:**
- Create: `src/tools/directSelect.ts`, `src/tools/__tests__/directSelect.test.ts`

**Interfaces (Produces):**
- `class DirectSelectTool { constructor(doc: EditorDoc); pointerDown(p: Vec, m?: Modifiers): void; pointerDrag(p: Vec, m?: Modifiers): void; pointerUp(p: Vec, m?: Modifiers): void; get selectedSegments(): paper.Segment[]; }`

- [ ] **Step 1: Write failing tests** covering: click an anchor selects it; drag an anchor moves its point; drag a handle changes handle and mirrors on smooth points; Alt-drag a handle breaks the mirror; clicking the stroke selects all the path's anchors; empty click clears.

```ts
import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { DirectSelectTool } from "../directSelect";

function makePath(doc: ReturnType<typeof createDocument>) {
  const s = doc.scope;
  const p = new s.Path();
  p.strokeColor = new s.Color(0, 0, 0);
  p.add(new s.Point(50, 50));
  p.add(new s.Point(150, 50));
  p.add(new s.Point(150, 150));
  return p as unknown as paper.Path;
}

describe("DirectSelectTool", () => {
  it("clicking an anchor selects just that segment", () => {
    const doc = createDocument(300, 300);
    makePath(doc);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 150, y: 50 });
    t.pointerUp({ x: 150, y: 50 });
    expect(t.selectedSegments.length).toBe(1);
    expect(t.selectedSegments[0].point.x).toBeCloseTo(150, 3);
  });

  it("dragging an anchor moves its point", () => {
    const doc = createDocument(300, 300);
    const path = makePath(doc);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 50, y: 50 });
    t.pointerDrag({ x: 60, y: 70 });
    t.pointerUp({ x: 60, y: 70 });
    expect(path.segments[0].point.x).toBeCloseTo(60, 3);
    expect(path.segments[0].point.y).toBeCloseTo(70, 3);
  });

  it("dragging a smooth point's handle mirrors the opposite handle", () => {
    const doc = createDocument(300, 300);
    const s = doc.scope;
    const path = new s.Path();
    path.strokeColor = new s.Color(0, 0, 0);
    const seg = path.add(new s.Point(100, 100)) as unknown as paper.Segment;
    seg.handleOut = new s.Point(20, 0);
    seg.handleIn = new s.Point(-20, 0);
    const t = new DirectSelectTool(doc);
    // handleOut world pos = point + handleOut = (120,100); drag it to (120,130)
    t.pointerDown({ x: 120, y: 100 });
    t.pointerDrag({ x: 120, y: 130 });
    t.pointerUp({ x: 120, y: 130 });
    expect(seg.handleOut.y).toBeCloseTo(30, 2);
    expect(seg.handleIn.y).toBeCloseTo(-30, 2); // mirrored
  });

  it("Alt-dragging a handle breaks the mirror", () => {
    const doc = createDocument(300, 300);
    const s = doc.scope;
    const path = new s.Path();
    path.strokeColor = new s.Color(0, 0, 0);
    const seg = path.add(new s.Point(100, 100)) as unknown as paper.Segment;
    seg.handleOut = new s.Point(20, 0);
    seg.handleIn = new s.Point(-20, 0);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 120, y: 100 }, { alt: true });
    t.pointerDrag({ x: 120, y: 130 }, { alt: true });
    t.pointerUp({ x: 120, y: 130 }, { alt: true });
    expect(seg.handleOut.y).toBeCloseTo(30, 2);
    expect(seg.handleIn.y).toBeCloseTo(0, 2); // unchanged
  });

  it("clicking the stroke selects the whole path's anchors", () => {
    const doc = createDocument(300, 300);
    makePath(doc);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 100, y: 50 }); // midpoint of first segment
    t.pointerUp({ x: 100, y: 50 });
    expect(t.selectedSegments.length).toBe(3);
  });

  it("empty click clears selection", () => {
    const doc = createDocument(300, 300);
    makePath(doc);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 150, y: 50 });
    t.pointerUp({ x: 150, y: 50 });
    t.pointerDown({ x: 280, y: 280 });
    t.pointerUp({ x: 280, y: 280 });
    expect(t.selectedSegments.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/tools/directSelect.ts`:

```ts
import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { isSmooth } from "@/engine/anchors";

type DragKind = "point" | "handleIn" | "handleOut" | null;

export class DirectSelectTool {
  private doc: EditorDoc;
  private dragSeg: paper.Segment | null = null;
  private dragKind: DragKind = null;
  private wasSmooth = false;
  private marquee: paper.Path | null = null;
  private downPoint: Vec | null = null;
  private dragging = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get selectedSegments(): paper.Segment[] {
    const out: paper.Segment[] = [];
    for (const layer of this.doc.project.layers) {
      for (const item of layer.children) {
        const path = item as paper.Path;
        if (!path.segments) continue;
        for (const seg of path.segments) if (seg.selected) out.push(seg);
      }
    }
    return out;
  }

  private clearSegments(): void {
    for (const seg of this.selectedSegments) seg.selected = false;
  }

  pointerDown(p: Vec, m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.downPoint = { x: p.x, y: p.y };
    this.dragging = false;
    this.dragSeg = null;
    this.dragKind = null;

    const hit = this.doc.project.hitTest(this.pt(p), {
      segments: true,
      handles: true,
      stroke: true,
      tolerance: HIT_TOLERANCE,
    });

    if (hit && hit.segment && (hit.type === "segment" || hit.type === "handle-in" || hit.type === "handle-out")) {
      if (!m.shift) this.clearSegments();
      hit.segment.selected = true;
      this.dragSeg = hit.segment;
      this.wasSmooth = isSmooth(hit.segment);
      this.dragKind = hit.type === "handle-in" ? "handleIn" : hit.type === "handle-out" ? "handleOut" : "point";
      return;
    }

    if (hit && hit.type === "stroke" && hit.item) {
      if (!m.shift) this.clearSegments();
      (hit.item as paper.Path).fullySelected = true;
      return;
    }

    if (!m.shift) this.clearSegments();
  }

  pointerDrag(p: Vec, m: Modifiers = {}): void {
    if (this.dragSeg && this.dragKind) {
      const seg = this.dragSeg;
      if (this.dragKind === "point") {
        seg.point = this.pt(p);
      } else if (this.dragKind === "handleOut") {
        const h = this.pt(p).subtract(seg.point);
        seg.handleOut = h;
        if (this.wasSmooth && !m.alt) seg.handleIn = h.multiply(-1);
      } else if (this.dragKind === "handleIn") {
        const h = this.pt(p).subtract(seg.point);
        seg.handleIn = h;
        if (this.wasSmooth && !m.alt) seg.handleOut = h.multiply(-1);
      }
      return;
    }
    // marquee
    if (!this.downPoint) return;
    this.dragging = true;
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({ from: this.pt(this.downPoint), to: this.pt(p) });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.dragging && this.downPoint && !this.dragSeg) {
      const rect = new this.doc.scope.Rectangle(this.pt(this.downPoint), this.pt(p));
      const marquee = this.marquee;
      for (const layer of this.doc.project.layers) {
        for (const item of layer.children) {
          if (item === marquee) continue;
          const path = item as paper.Path;
          if (!path.segments) continue;
          for (const seg of path.segments) {
            if (rect.contains(seg.point)) seg.selected = true;
          }
        }
      }
    }
    if (this.marquee) {
      this.marquee.remove();
      this.marquee = null;
    }
    this.dragSeg = null;
    this.dragKind = null;
    this.downPoint = null;
    this.dragging = false;
  }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: Direct Selection tool (anchors/handles/marquee, tests)`.

---

### Task 2: Wire Direct Selection into the canvas

**Files:** Modify `src/tools/useActiveTool.ts`.

- [ ] **Step 1:** Construct `const directSelect = new DirectSelectTool(doc);` and route pointer events when `active() === "direct-select"` (down/drag/up), calling `scope.view.update()`. Show segment handles by leaving Paper's `selected` rendering on.

- [ ] **Step 2:** `npm run build`; Playwright: draw a path with Pen, switch to Direct Select (press A), drag an anchor, screenshot shows the moved anchor.

- [ ] **Step 3: Commit** — `feat: wire Direct Selection tool into artboard`.

---

## Self-Review

**Spec coverage:** anchor select/drag, handle drag with smooth mirroring + Alt-break, path select via stroke, marquee, clear → Task 1. Wiring → Task 2. ✓
**Placeholder scan:** none. **Type consistency:** `DirectSelectTool` signature stable; reuses `isSmooth`. ✓
