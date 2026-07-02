import { describe, it, expect } from "vitest";
import { clampZoom, zoomAtPoint, fitBounds } from "../viewport";

describe("viewport math", () => {
  it("clampZoom limits to 0.03..64", () => {
    expect(clampZoom(0.001)).toBeCloseTo(0.03, 5);
    expect(clampZoom(100000)).toBeCloseTo(64, 5);
    expect(clampZoom(2)).toBe(2);
  });

  it("zoomAtPoint keeps the pivot fixed on screen", () => {
    const state = { zoom: 1, center: { x: 100, y: 100 } };
    const next = zoomAtPoint(state, 2, { x: 150, y: 120 });
    expect(next.zoom).toBe(2);
    expect(next.center.x).toBeCloseTo(125, 5);
    expect(next.center.y).toBeCloseTo(110, 5);
  });

  it("zoomAtPoint clamps zoom", () => {
    const next = zoomAtPoint({ zoom: 60, center: { x: 0, y: 0 } }, 4, { x: 10, y: 10 });
    expect(next.zoom).toBeCloseTo(64, 5);
  });

  it("fitBounds computes zoom to fit and centers on the bounds", () => {
    const f = fitBounds({ width: 800, height: 600 }, { x: 0, y: 0, width: 400, height: 400 }, 0);
    expect(f.zoom).toBeCloseTo(1.5, 5);
    expect(f.center.x).toBeCloseTo(200, 5);
    expect(f.center.y).toBeCloseTo(200, 5);
  });
});
