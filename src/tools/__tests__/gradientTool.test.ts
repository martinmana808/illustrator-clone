import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { GradientTool } from "../gradientTool";
import { readGradient } from "@/engine/gradients";

describe("GradientTool", () => {
  it("dragging across the selected shape sets a gradient with that direction", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 100, 60) as unknown as paper.Item;
    r.selected = true;
    const t = new GradientTool(doc);
    t.pointerDown({ x: 0, y: 30 });
    t.pointerDrag({ x: 100, y: 30 });
    t.pointerUp({ x: 100, y: 30 });
    const g = readGradient(r)!;
    expect(g).not.toBeNull();
    expect(g.from.x).toBeCloseTo(0, 2);
    expect(g.to.x).toBeCloseTo(100, 2);
    expect(g.stops.length).toBeGreaterThanOrEqual(2);
  });

  it("applies a default gradient when the shape had a solid fill", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 100, 60) as unknown as paper.Path;
    r.fillColor = new doc.scope.Color(1, 0, 0);
    r.selected = true;
    const t = new GradientTool(doc);
    t.pointerDown({ x: 0, y: 30 });
    t.pointerUp({ x: 80, y: 30 });
    expect(readGradient(r as unknown as paper.Item)).not.toBeNull();
  });
});
