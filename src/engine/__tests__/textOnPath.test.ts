import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { layoutTextOnPath } from "../textOnPath";

const w10 = () => 10;

describe("layoutTextOnPath", () => {
  it("places glyphs along a horizontal line with ~0 rotation", () => {
    const doc = createDocument(300, 300);
    const line = new doc.scope.Path([
      [0, 50],
      [100, 50],
    ]) as unknown as paper.Path;
    const g = layoutTextOnPath(line, "ABC", w10);
    expect(g.length).toBe(3);
    expect(g[0].x).toBeCloseTo(0, 3);
    expect(g[0].y).toBeCloseTo(50, 3);
    expect(g[1].x).toBeCloseTo(10, 3);
    expect(g[2].x).toBeCloseTo(20, 3);
    expect(Math.abs(g[0].rotation)).toBeLessThan(1);
  });

  it("rotates glyphs to the tangent of a vertical line (~90°)", () => {
    const doc = createDocument(300, 300);
    const line = new doc.scope.Path([
      [50, 0],
      [50, 100],
    ]) as unknown as paper.Path;
    const g = layoutTextOnPath(line, "A", w10);
    expect(Math.abs(g[0].rotation)).toBeCloseTo(90, 1);
  });

  it("stops placing when the text runs past the end of the path", () => {
    const doc = createDocument(300, 300);
    const line = new doc.scope.Path([
      [0, 10],
      [25, 10],
    ]) as unknown as paper.Path; // length 25
    const g = layoutTextOnPath(line, "ABCDE", w10); // widths 10 → offsets 0,10,20,30…
    expect(g.length).toBe(3); // offsets 0,10,20 are <= 25; 30 breaks
  });
});
