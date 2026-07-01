import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { scaleItems, rotateItems, translateItems } from "../transform";

describe("transform helpers", () => {
  it("scaleItems scales about a pivot", () => {
    const doc = createDocument(300, 300);
    const r = addRectangle(doc, 0, 0, 10, 10) as unknown as paper.Item;
    scaleItems([r], 2, 2, 0, 0);
    expect(r.bounds.width).toBeCloseTo(20, 3);
    expect(r.bounds.height).toBeCloseTo(20, 3);
    expect(r.bounds.left).toBeCloseTo(0, 3);
  });

  it("translateItems moves items", () => {
    const doc = createDocument(300, 300);
    const r = addRectangle(doc, 10, 10, 10, 10) as unknown as paper.Item;
    translateItems([r], 5, 7);
    expect(r.bounds.left).toBeCloseTo(15, 3);
    expect(r.bounds.top).toBeCloseTo(17, 3);
  });

  it("rotateItems rotates about a center (90° swaps a non-square's extents)", () => {
    const doc = createDocument(300, 300);
    const r = addRectangle(doc, 0, 0, 20, 10) as unknown as paper.Item;
    const cx = r.bounds.center.x;
    const cy = r.bounds.center.y;
    rotateItems([r], 90, cx, cy);
    // A 20×10 rotated 90° about its center becomes 10 wide, 20 tall.
    expect(r.bounds.width).toBeCloseTo(10, 3);
    expect(r.bounds.height).toBeCloseTo(20, 3);
  });
});
