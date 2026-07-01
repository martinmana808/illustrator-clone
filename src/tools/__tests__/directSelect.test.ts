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
    t.pointerDown({ x: 120, y: 100 });
    t.pointerDrag({ x: 120, y: 130 });
    t.pointerUp({ x: 120, y: 130 });
    expect(seg.handleOut.y).toBeCloseTo(30, 2);
    expect(seg.handleIn.y).toBeCloseTo(-30, 2);
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
    expect(seg.handleIn.y).toBeCloseTo(0, 2);
  });

  it("clicking the stroke selects the whole path's anchors", () => {
    const doc = createDocument(300, 300);
    makePath(doc);
    const t = new DirectSelectTool(doc);
    t.pointerDown({ x: 100, y: 50 });
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
