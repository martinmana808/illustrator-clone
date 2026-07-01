import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { PenTool } from "../pen";

function clickAt(pen: PenTool, x: number, y: number, m = {}) {
  pen.pointerDown({ x, y }, m);
  pen.pointerUp({ x, y }, m);
}
function lastPath(doc: ReturnType<typeof createDocument>): paper.Path {
  return doc.project.activeLayer.lastChild as unknown as paper.Path;
}

describe("PenTool — corner anchors", () => {
  it("first click starts a path with one corner anchor", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 20, 20);
    expect(pen.currentPath).not.toBeNull();
    expect(pen.currentPath!.segments.length).toBe(1);
    expect(pen.currentPath!.segments[0].point.x).toBeCloseTo(20, 5);
    expect(pen.currentPath!.segments[0].handleOut.length).toBeCloseTo(0, 6);
  });

  it("subsequent clicks append corner anchors to the same path", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 20, 20);
    clickAt(pen, 60, 20);
    clickAt(pen, 60, 60);
    expect(pen.currentPath!.segments.length).toBe(3);
    expect(pen.currentPath!.closed).toBe(false);
  });
});

describe("PenTool — smooth anchors", () => {
  it("click-drag creates a smooth anchor with mirrored handles", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    pen.pointerDown({ x: 50, y: 50 });
    pen.pointerDrag({ x: 70, y: 50 });
    pen.pointerUp({ x: 70, y: 50 });
    const s = pen.currentPath!.segments[0];
    expect(s.handleOut.x).toBeCloseTo(20, 4);
    expect(s.handleIn.x).toBeCloseTo(-20, 4);
  });

  it("shift-drag constrains handle to 45°", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    pen.pointerDown({ x: 50, y: 50 });
    pen.pointerDrag({ x: 70, y: 53 }, { shift: true });
    const s = pen.currentPath!.segments[0];
    expect(s.handleOut.y).toBeCloseTo(0, 4);
  });
});

describe("PenTool — close path", () => {
  it("clicking the first anchor closes the path", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 20, 20);
    clickAt(pen, 80, 20);
    clickAt(pen, 80, 80);
    const path = pen.currentPath!;
    clickAt(pen, 21, 20);
    expect(path.closed).toBe(true);
    expect(path.segments.length).toBe(3);
  });

  it("hoverCursor reports 'close' over the first anchor while drawing", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 20, 20);
    clickAt(pen, 80, 20);
    expect(pen.hoverCursor({ x: 20, y: 20 })).toBe("close");
  });
});

describe("PenTool — rubber band", () => {
  it("previewPoint tracks the cursor while a path is open", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    expect(pen.previewPoint).toBeNull();
    clickAt(pen, 20, 20);
    pen.pointerMove({ x: 55, y: 40 });
    expect(pen.previewPoint).toEqual({ x: 55, y: 40 });
    pen.finish();
    expect(pen.previewPoint).toBeNull();
  });
});

describe("PenTool — add anchor", () => {
  it("clicking on a path stroke inserts an anchor, preserving shape", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 0, 50);
    clickAt(pen, 100, 50);
    pen.finish();
    const path = lastPath(doc);
    const beforeLen = path.length;
    clickAt(pen, 50, 50);
    expect(path.segments.length).toBe(3);
    expect(path.length).toBeCloseTo(beforeLen, 3);
  });

  it("hoverCursor reports 'add' over a stroke when not drawing", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 0, 50);
    clickAt(pen, 100, 50);
    pen.finish();
    expect(pen.hoverCursor({ x: 50, y: 50 })).toBe("add");
  });
});

describe("PenTool — delete anchor", () => {
  it("clicking an existing middle anchor (not drawing) removes it", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 0, 50);
    clickAt(pen, 50, 50);
    clickAt(pen, 100, 50);
    pen.finish();
    const path = lastPath(doc);
    expect(path.segments.length).toBe(3);
    clickAt(pen, 50, 50);
    expect(path.segments.length).toBe(2);
  });
});

describe("PenTool — convert anchor (Alt)", () => {
  it("Alt-drag on a corner anchor pulls out symmetric handles", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 0, 50);
    clickAt(pen, 100, 50);
    pen.finish();
    const path = lastPath(doc);
    pen.pointerDown({ x: 0, y: 50 }, { alt: true });
    pen.pointerDrag({ x: 10, y: 50 }, { alt: true });
    pen.pointerUp({ x: 10, y: 50 }, { alt: true });
    expect(path.segments[0].handleOut.length).toBeGreaterThan(1);
  });

  it("Alt-click on a smooth anchor collapses it to a corner", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    pen.pointerDown({ x: 0, y: 50 });
    pen.pointerDrag({ x: 0, y: 30 });
    pen.pointerUp({ x: 0, y: 30 });
    clickAt(pen, 100, 50);
    pen.finish();
    const path = lastPath(doc);
    expect(path.segments[0].handleOut.length).toBeGreaterThan(1);
    pen.pointerDown({ x: 0, y: 50 }, { alt: true });
    pen.pointerUp({ x: 0, y: 50 }, { alt: true });
    expect(path.segments[0].handleIn.length).toBeCloseTo(0, 4);
    expect(path.segments[0].handleOut.length).toBeCloseTo(0, 4);
  });
});

describe("PenTool — continue open path", () => {
  it("clicking an endpoint of an existing open path resumes drawing", () => {
    const doc = createDocument(400, 400);
    const pen = new PenTool(doc);
    clickAt(pen, 0, 50);
    clickAt(pen, 50, 50);
    pen.finish();
    const path = lastPath(doc);
    expect(path.segments.length).toBe(2);
    clickAt(pen, 50, 50);
    expect(pen.currentPath).toBe(path);
    clickAt(pen, 90, 80);
    expect(path.segments.length).toBe(3);
  });
});
