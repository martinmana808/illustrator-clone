import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import { buildRectangle, buildEllipse, buildPolygon, buildStar, buildLine } from "../shapes";

describe("shape builders", () => {
  it("rectangle has the right bounds and area", () => {
    const doc = createDocument(400, 400);
    const r = buildRectangle(doc.scope, 10, 20, 100, 50);
    expect(r.bounds.left).toBeCloseTo(10, 3);
    expect(r.bounds.top).toBeCloseTo(20, 3);
    expect(Math.abs(r.area)).toBeCloseTo(5000, 1);
  });

  it("rounded rectangle has more than 4 segments", () => {
    const doc = createDocument(400, 400);
    const r = buildRectangle(doc.scope, 0, 0, 100, 100, 12);
    expect(r.segments.length).toBeGreaterThan(4);
  });

  it("ellipse area ≈ π·a·b (bezier approximation, within 1%)", () => {
    const doc = createDocument(400, 400);
    const e = buildEllipse(doc.scope, 0, 0, 100, 60);
    const expected = Math.PI * 50 * 30;
    expect(Math.abs(e.area)).toBeGreaterThan(expected * 0.99);
    expect(Math.abs(e.area)).toBeLessThan(expected * 1.01);
  });

  it("polygon has `sides` segments", () => {
    const doc = createDocument(400, 400);
    const p = buildPolygon(doc.scope, 200, 200, 80, 6);
    expect(p.segments.length).toBe(6);
  });

  it("star has 2·points segments", () => {
    const doc = createDocument(400, 400);
    const s = buildStar(doc.scope, 200, 200, 80, 40, 5);
    expect(s.segments.length).toBe(10);
  });

  it("line has 2 segments", () => {
    const doc = createDocument(400, 400);
    const l = buildLine(doc.scope, 0, 0, 100, 100);
    expect(l.segments.length).toBe(2);
  });
});
