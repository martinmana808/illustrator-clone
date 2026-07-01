import { describe, it, expect } from "vitest";
import { createDocument, addRectangle, activeLayerItemCount, toSVG } from "../document";
import { pathArea } from "../geometry";

describe("document engine", () => {
  it("creates a document with an active layer", () => {
    const doc = createDocument(800, 600);
    expect(doc.project.layers.length).toBeGreaterThanOrEqual(1);
    expect(activeLayerItemCount(doc)).toBe(0);
  });

  it("adds a rectangle to the active layer", () => {
    const doc = createDocument(800, 600);
    const rect = addRectangle(doc, 10, 10, 30, 40);
    expect(activeLayerItemCount(doc)).toBe(1);
    expect(pathArea(rect)).toBeCloseTo(1200, 5);
  });

  it("serializes to SVG containing a path", () => {
    const doc = createDocument(800, 600);
    addRectangle(doc, 0, 0, 10, 10);
    const svg = toSVG(doc);
    expect(svg).toContain("<svg");
    expect(svg.toLowerCase()).toMatch(/<path|<rect/);
  });

  it("isolates scopes between documents", () => {
    const a = createDocument(100, 100);
    const b = createDocument(100, 100);
    addRectangle(a, 0, 0, 5, 5);
    expect(activeLayerItemCount(a)).toBe(1);
    expect(activeLayerItemCount(b)).toBe(0);
  });
});
