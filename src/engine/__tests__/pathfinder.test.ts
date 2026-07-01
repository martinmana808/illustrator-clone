import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import {
  totalArea,
  unite,
  intersect,
  minusFront,
  exclude,
  minusBack,
  divide,
  trim,
  merge,
  crop,
  outline,
  PATHFINDER_OPS,
  applyPathfinder,
} from "../pathfinder";

type Doc = ReturnType<typeof createDocument>;

/** Canonical overlapping squares: A (0,0) and B (50,50), each 100×100. */
function squares(doc: Doc) {
  const s = doc.scope;
  const A = new s.Path.Rectangle({ point: [0, 0], size: [100, 100] });
  const B = new s.Path.Rectangle({ point: [50, 50], size: [100, 100] });
  A.fillColor = new s.Color(1, 0, 0);
  B.fillColor = new s.Color(0, 0, 1);
  return { A: A as unknown as paper.PathItem, B: B as unknown as paper.PathItem };
}

describe("pathfinder helpers", () => {
  it("totalArea sums absolute areas", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    expect(totalArea([A, B])).toBeCloseTo(20000, 3);
  });
});

describe("pathfinder shape modes", () => {
  it("unite merges to a single piece of the union area", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = unite([A, B]);
    expect(out.length).toBe(1);
    expect(Math.abs(out[0].area)).toBeCloseTo(17500, 1);
  });

  it("intersect keeps only the overlap", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = intersect([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(2500, 1);
  });

  it("minusFront subtracts the front (B) from the back (A)", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = minusFront([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(7500, 1);
  });

  it("exclude keeps non-overlapping regions", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = exclude([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(15000, 1);
  });
});

describe("pathfinder minus back", () => {
  it("subtracts back objects from the front object", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = minusBack([A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(7500, 1);
  });
});

describe("pathfinder divide", () => {
  it("splits two overlapping squares into 3 faces conserving area", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = divide([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    expect(out.length).toBe(3);
    expect(out.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(17500, 1);
  });

  it("returns non-overlapping shapes unchanged (2 faces)", () => {
    const doc = createDocument(400, 400);
    const s = doc.scope;
    const A = new s.Path.Rectangle({ point: [0, 0], size: [40, 40] }) as unknown as paper.PathItem;
    const B = new s.Path.Rectangle({ point: [100, 100], size: [40, 40] }) as unknown as paper.PathItem;
    const out = divide([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    expect(out.length).toBe(2);
    expect(out.reduce((sum, p) => sum + Math.abs(p.area), 0)).toBeCloseTo(3200, 1);
  });
});

describe("pathfinder trim", () => {
  it("clips back shapes by the ones in front; area = union", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = trim([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    expect(out.length).toBe(2);
    expect(out.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(17500, 1);
  });
});

describe("pathfinder merge", () => {
  it("unites same-colored overlapping regions after trimming", () => {
    const doc = createDocument(400, 400);
    const s = doc.scope;
    const A = new s.Path.Rectangle({ point: [0, 0], size: [100, 100] });
    const B = new s.Path.Rectangle({ point: [50, 0], size: [100, 100] });
    const same = new s.Color(1, 0, 0);
    A.fillColor = same;
    B.fillColor = same;
    const out = merge([A as unknown as paper.PathItem, B as unknown as paper.PathItem]);
    expect(out.length).toBe(1);
    expect(Math.abs(out[0].area)).toBeCloseTo(15000, 1);
  });
});

describe("pathfinder crop", () => {
  it("keeps only what is inside the top shape", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = crop([A, B]).filter((p) => Math.abs(p.area) > 1e-6);
    expect(out.reduce((s, p) => s + Math.abs(p.area), 0)).toBeCloseTo(2500, 1);
  });
});

describe("pathfinder outline", () => {
  it("produces stroked, unfilled paths with length", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = outline([A, B]).filter((p) => p.length > 1e-6);
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.fillColor).toBeNull();
      expect(p.strokeColor).not.toBeNull();
    }
  });
});

describe("pathfinder registry", () => {
  it("exposes all 10 operations", () => {
    expect(PATHFINDER_OPS.map((o) => o.id).sort()).toEqual([
      "crop",
      "divide",
      "exclude",
      "intersect",
      "merge",
      "minusBack",
      "minusFront",
      "outline",
      "trim",
      "unite",
    ]);
  });

  it("applyPathfinder dispatches by id", () => {
    const doc = createDocument(400, 400);
    const { A, B } = squares(doc);
    const out = applyPathfinder("unite", [A, B]);
    expect(Math.abs(out[0].area)).toBeCloseTo(17500, 1);
  });
});
