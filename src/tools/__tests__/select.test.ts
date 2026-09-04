import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { SelectTool } from "../select";

function rect(doc: ReturnType<typeof createDocument>, x: number, y: number, w: number, h: number) {
  const r = addRectangle(doc, x, y, w, h);
  (r as unknown as paper.Path).fillColor = new doc.scope.Color(0.5, 0.5, 0.5);
  return r;
}

describe("SelectTool", () => {
  it("click selects the item under the cursor", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 80, 80);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 40, y: 40 });
    sel.pointerUp({ x: 40, y: 40 });
    expect(sel.selection.length).toBe(1);
  });

  it("empty click clears selection", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 80, 80);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 40, y: 40 });
    sel.pointerUp({ x: 40, y: 40 });
    sel.pointerDown({ x: 300, y: 300 });
    sel.pointerUp({ x: 300, y: 300 });
    expect(sel.selection.length).toBe(0);
  });

  it("shift-click adds a second item", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    rect(doc, 100, 100, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 20, y: 20 });
    sel.pointerUp({ x: 20, y: 20 });
    sel.pointerDown({ x: 110, y: 110 }, { shift: true });
    sel.pointerUp({ x: 110, y: 110 }, { shift: true });
    expect(sel.selection.length).toBe(2);
  });

  it("marquee drag selects intersecting items", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    rect(doc, 100, 100, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 0, y: 0 });
    sel.pointerDrag({ x: 160, y: 160 });
    sel.pointerUp({ x: 160, y: 160 });
    expect(sel.selection.length).toBe(2);
  });

  it("marquee drag skips artboard chrome (data.isChrome)", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    const chrome = rect(doc, 0, 0, 400, 400) as unknown as paper.Path;
    chrome.data.isChrome = true;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 5, y: 5 });
    sel.pointerDrag({ x: 60, y: 60 });
    sel.pointerUp({ x: 60, y: 60 });
    expect(sel.selection.length).toBe(1);
    expect(sel.selection).not.toContain(chrome);
  });

  it("selectAll selects every item on the active layer", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    rect(doc, 100, 100, 40, 40);
    const sel = new SelectTool(doc);
    sel.selectAll();
    expect(sel.selection.length).toBe(2);
  });

  it("selectAll skips artboard chrome (data.isChrome)", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    const chrome = rect(doc, 0, 0, 400, 400) as unknown as paper.Path;
    chrome.data.isChrome = true;
    const sel = new SelectTool(doc);
    sel.selectAll();
    expect(sel.selection.length).toBe(1);
    expect(sel.selection).not.toContain(chrome);
  });

  it("deleteSelection removes selected items", () => {
    const doc = createDocument(400, 400);
    rect(doc, 10, 10, 40, 40);
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 20, y: 20 });
    sel.pointerUp({ x: 20, y: 20 });
    sel.deleteSelection();
    expect(doc.project.activeLayer.children.length).toBe(0);
  });
});

describe("SelectTool alt-drag duplicate", () => {
  it("alt-drag moves a copy and leaves the original in place", () => {
    const doc = createDocument(400, 400);
    const r = rect(doc, 50, 50, 40, 40) as unknown as paper.Path;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 60, y: 60 }, { alt: true });
    sel.pointerDrag({ x: 110, y: 110 }, { alt: true });
    sel.pointerUp({ x: 110, y: 110 }, { alt: true });

    expect(doc.project.activeLayer.children.length).toBe(2);
    // Original stayed put.
    expect(r.bounds.left).toBeCloseTo(50, 3);
    expect(r.bounds.top).toBeCloseTo(50, 3);
    // The clone is selected and moved by the drag delta.
    expect(sel.selection.length).toBe(1);
    expect(sel.selection[0]).not.toBe(r);
    expect(sel.selection[0].bounds.left).toBeCloseTo(100, 3);
  });

  it("alt-drag of a selected group duplicates it once (no per-child copies)", () => {
    const doc = createDocument(400, 400);
    const g = new doc.scope.Group([
      rect(doc, 50, 50, 20, 20) as unknown as paper.Path,
      rect(doc, 80, 80, 20, 20) as unknown as paper.Path,
    ]);
    g.selected = true;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 60, y: 60 }, { alt: true });
    sel.pointerUp({ x: 60, y: 60 }, { alt: true });
    // One group became two groups — not two groups plus stray child copies.
    expect(doc.project.activeLayer.children.length).toBe(2);
    expect(doc.project.activeLayer.children.every((c) => c.className === "Group")).toBe(true);
  });
});

describe("SelectTool transforms", () => {
  it("dragging a selected item moves it", () => {
    const doc = createDocument(400, 400);
    const r = rect(doc, 50, 50, 40, 40) as unknown as paper.Path;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 60, y: 60 }); // selects + move mode
    sel.pointerDrag({ x: 80, y: 80 });
    sel.pointerUp({ x: 80, y: 80 });
    expect(r.bounds.left).toBeCloseTo(70, 3);
    expect(r.bounds.top).toBeCloseTo(70, 3);
  });

  it("dragging the SE handle scales the selection", () => {
    const doc = createDocument(400, 400);
    const r = rect(doc, 50, 50, 100, 100) as unknown as paper.Path;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 100, y: 100 }); // select
    sel.pointerUp({ x: 100, y: 100 });
    sel.pointerDown({ x: 150, y: 150 }); // SE handle
    sel.pointerDrag({ x: 200, y: 200 }); // scale 1.5x about NW pivot (50,50)
    sel.pointerUp({ x: 200, y: 200 });
    expect(r.bounds.width).toBeCloseTo(150, 2);
    expect(r.bounds.left).toBeCloseTo(50, 2); // pivot stays put
  });

  it("dragging the rotation ring rotates the selection", () => {
    const doc = createDocument(400, 400);
    const r = rect(doc, 50, 50, 100, 60) as unknown as paper.Path;
    const sel = new SelectTool(doc);
    sel.pointerDown({ x: 100, y: 80 }); // select
    sel.pointerUp({ x: 100, y: 80 });
    const before = { x: r.segments[0].point.x, y: r.segments[0].point.y };
    sel.pointerDown({ x: 36, y: 36 }); // rotation ring near NW corner
    sel.pointerDrag({ x: 36, y: 90 });
    sel.pointerUp({ x: 36, y: 90 });
    const after = { x: r.segments[0].point.x, y: r.segments[0].point.y };
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    expect(moved).toBeGreaterThan(1); // a rotation actually happened
  });
});
