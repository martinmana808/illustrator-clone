import { describe, it, expect } from "vitest";
import {
  handlePoint,
  handlePoints,
  pivotFor,
  axisFactors,
  hitHandle,
  hitTransform,
} from "../transformBox";

const B = { x: 100, y: 100, width: 200, height: 100 };

describe("transformBox geometry", () => {
  it("handlePoints returns all 8 handles", () => {
    expect(handlePoints(B).length).toBe(8);
  });

  it("corner handles sit at the corners", () => {
    expect(handlePoint(B, "nw")).toEqual({ x: 100, y: 100 });
    expect(handlePoint(B, "se")).toEqual({ x: 300, y: 200 });
    expect(handlePoint(B, "n")).toEqual({ x: 200, y: 100 });
  });

  it("pivotFor returns the opposite corner", () => {
    expect(pivotFor("se", B)).toEqual({ x: 100, y: 100 });
    expect(pivotFor("nw", B)).toEqual({ x: 300, y: 200 });
  });

  it("axisFactors limits edge handles to one axis", () => {
    expect(axisFactors("n")).toEqual({ ax: 0, ay: 1 });
    expect(axisFactors("e")).toEqual({ ax: 1, ay: 0 });
    expect(axisFactors("se")).toEqual({ ax: 1, ay: 1 });
  });

  it("hitHandle finds a handle within tolerance", () => {
    expect(hitHandle(B, 301, 201, 6)).toBe("se");
    expect(hitHandle(B, 150, 150, 6)).toBeNull();
  });

  it("hitTransform classifies scale / rotate / none", () => {
    expect(hitTransform(B, 300, 200, 6, 24)).toEqual({ kind: "scale", handle: "se" });
    expect(hitTransform(B, 315, 215, 6, 24)).toEqual({ kind: "rotate" }); // outside near corner
    expect(hitTransform(B, 200, 150, 6, 24)).toBeNull(); // inside
  });
});
