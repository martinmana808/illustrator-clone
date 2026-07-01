import { describe, it, expect, beforeAll } from "vitest";
import paper from "paper";
import { pathArea, segmentCount, isClosed, clonePath } from "../geometry";

beforeAll(() => {
  paper.setup(new paper.Size(800, 600));
});

describe("geometry helpers", () => {
  it("pathArea returns absolute area regardless of winding", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    expect(pathArea(r)).toBeCloseTo(200, 5);
  });

  it("segmentCount counts anchors", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    expect(segmentCount(r)).toBe(4);
  });

  it("isClosed reflects closed state", () => {
    const line = new paper.Path([
      [0, 0],
      [10, 0],
    ]);
    expect(isClosed(line)).toBe(false);
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [5, 5] });
    expect(isClosed(r)).toBe(true);
  });

  it("clonePath produces an equal but distinct path", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    const c = clonePath(r);
    expect(c).not.toBe(r);
    expect(pathArea(c)).toBeCloseTo(pathArea(r), 5);
  });
});
