import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { ShapeTool } from "../shapeTool";

function draw(tool: ShapeTool, x0: number, y0: number, x1: number, y1: number, m = {}) {
  tool.pointerDown({ x: x0, y: y0 }, m);
  tool.pointerDrag({ x: x1, y: y1 }, m);
  return tool.currentPath as paper.Path;
}

describe("ShapeTool", () => {
  it("rectangle drag creates a rect of the dragged bounds", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("rectangle");
    const p = draw(t, 10, 20, 110, 70);
    expect(p.bounds.left).toBeCloseTo(10, 2);
    expect(p.bounds.top).toBeCloseTo(20, 2);
    expect(p.bounds.width).toBeCloseTo(100, 2);
    expect(p.bounds.height).toBeCloseTo(50, 2);
  });

  it("Shift constrains a rectangle to a square", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("rectangle");
    const p = draw(t, 0, 0, 100, 40, { shift: true });
    expect(p.bounds.width).toBeCloseTo(100, 2);
    expect(p.bounds.height).toBeCloseTo(100, 2);
  });

  it("Alt draws a rectangle from the center", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("rectangle");
    const p = draw(t, 100, 100, 140, 120, { alt: true });
    expect(p.bounds.width).toBeCloseTo(80, 2);
    expect(p.bounds.height).toBeCloseTo(40, 2);
    expect(p.bounds.center.x).toBeCloseTo(100, 2);
    expect(p.bounds.center.y).toBeCloseTo(100, 2);
  });

  it("ellipse drag creates an ellipse in the bounds", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("ellipse");
    const p = draw(t, 0, 0, 100, 60);
    expect(p.bounds.width).toBeCloseTo(100, 1);
    expect(p.bounds.height).toBeCloseTo(60, 1);
  });

  it("line drag creates a 2-segment path", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("line");
    const p = draw(t, 0, 0, 100, 100);
    expect(p.segments.length).toBe(2);
  });

  it("polygon drag creates a shape with `sides` segments", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("polygon");
    const p = draw(t, 200, 200, 200, 120); // radius 80 upward
    expect(p.segments.length).toBe(6);
  });

  it("star drag creates 2·points segments", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("star");
    const p = draw(t, 200, 200, 200, 120);
    expect(p.segments.length).toBe(10);
  });

  it("ArrowUp adds a polygon side mid-draw", () => {
    const doc = createDocument(400, 400);
    const t = new ShapeTool(doc);
    t.setKind("polygon");
    draw(t, 200, 200, 200, 120);
    t.keyInput("ArrowUp");
    expect(t.currentPath!.segments.length).toBe(7);
  });
});
