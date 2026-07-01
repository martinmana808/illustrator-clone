import { describe, it, expect, beforeAll } from "vitest";
import paper from "paper";
import { isCorner, isSmooth, makeCorner, setSymmetricHandles, constrainAngle } from "../anchors";

beforeAll(() => paper.setup(new paper.Size(400, 400)));

function seg(x: number, y: number) {
  return new paper.Segment(new paper.Point(x, y));
}

describe("anchor helpers", () => {
  it("fresh segment is a corner", () => {
    expect(isCorner(seg(10, 10))).toBe(true);
    expect(isSmooth(seg(10, 10))).toBe(false);
  });

  it("setSymmetricHandles makes a smooth point with mirrored handles", () => {
    const s = seg(10, 10);
    setSymmetricHandles(s, { x: 5, y: 0 });
    expect(s.handleOut.x).toBeCloseTo(5, 5);
    expect(s.handleIn.x).toBeCloseTo(-5, 5);
    expect(isSmooth(s)).toBe(true);
    expect(isCorner(s)).toBe(false);
  });

  it("makeCorner zeroes handles", () => {
    const s = seg(10, 10);
    setSymmetricHandles(s, { x: 5, y: 3 });
    makeCorner(s);
    expect(s.handleIn.length).toBeCloseTo(0, 6);
    expect(s.handleOut.length).toBeCloseTo(0, 6);
    expect(isCorner(s)).toBe(true);
  });

  it("constrainAngle snaps a near-horizontal vector to 0°, preserving length", () => {
    const v = constrainAngle({ x: 10, y: 1 }, 45);
    expect(v.y).toBeCloseTo(0, 5);
    expect(v.x).toBeCloseTo(Math.hypot(10, 1), 5);
  });

  it("constrainAngle snaps a ~50° vector to 45°", () => {
    const len = 10;
    const a = (50 * Math.PI) / 180;
    const v = constrainAngle({ x: len * Math.cos(a), y: len * Math.sin(a) }, 45);
    const outAngle = Math.atan2(v.y, v.x) * (180 / Math.PI);
    expect(outAngle).toBeCloseTo(45, 4);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(len, 5);
  });
});
