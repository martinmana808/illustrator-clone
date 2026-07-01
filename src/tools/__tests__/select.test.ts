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
