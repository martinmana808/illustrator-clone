import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import { ZoomTool } from "../zoomTool";

describe("ZoomTool", () => {
  it("click zooms in 2x", () => {
    const doc = createDocument(800, 600);
    doc.scope.view.zoom = 1;
    doc.scope.view.center = new doc.scope.Point(400, 300);
    const z = new ZoomTool(doc);
    z.pointerDown({ x: 400, y: 300 });
    z.pointerUp({ x: 400, y: 300 });
    expect(doc.scope.view.zoom).toBeCloseTo(2, 5);
  });

  it("alt-click zooms out", () => {
    const doc = createDocument(800, 600);
    doc.scope.view.zoom = 2;
    doc.scope.view.center = new doc.scope.Point(400, 300);
    const z = new ZoomTool(doc);
    z.pointerDown({ x: 400, y: 300 }, { alt: true });
    z.pointerUp({ x: 400, y: 300 }, { alt: true });
    expect(doc.scope.view.zoom).toBeCloseTo(1, 5);
  });
});
