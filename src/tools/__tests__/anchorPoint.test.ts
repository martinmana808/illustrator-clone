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
    const path = smoothPath(doc);
    const tool = new AnchorPointTool(doc);
    tool.pointerDown({ x: 120, y: 100 }); // handleOut world pos
    tool.pointerDrag({ x: 120, y: 140 });
    tool.pointerUp({ x: 120, y: 140 });
    expect(path.segments[0].handleOut.y).toBeCloseTo(40, 1);
    expect(path.segments[0].handleIn.y).toBeCloseTo(0, 1);
  });
});
