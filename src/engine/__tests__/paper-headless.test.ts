import { describe, it, expect } from "vitest";
import paper from "paper";

describe("paper headless", () => {
  it("computes area of a rectangle path without a canvas", () => {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(800, 600));
    const rect = new scope.Path.Rectangle({
      point: [0, 0],
      size: [10, 20],
    });
    expect(Math.abs(rect.area)).toBeCloseTo(200, 5);
  });
});
