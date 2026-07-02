import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { applyGradient, readGradient, defaultGradient } from "../gradients";

function rect(doc: ReturnType<typeof createDocument>) {
  return addRectangle(doc, 0, 0, 100, 60) as unknown as paper.Item;
}

describe("gradients", () => {
  it("applyGradient + readGradient round-trip", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc);
    applyGradient([r], {
      type: "linear",
      stops: [
        { color: "#ff0000", offset: 0 },
        { color: "#0000ff", offset: 1 },
      ],
      from: { x: 0, y: 30 },
      to: { x: 100, y: 30 },
    });
    const g = readGradient(r)!;
    expect(g.type).toBe("linear");
    expect(g.stops.length).toBe(2);
    expect(g.stops[0].color).toBe("#ff0000");
    expect(g.stops[1].offset).toBe(1);
    expect(g.to.x).toBeCloseTo(100, 3);
  });

  it("radial type round-trips", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc);
    applyGradient([r], {
      type: "radial",
      stops: [
        { color: "#ffffff", offset: 0 },
        { color: "#000000", offset: 1 },
      ],
      from: { x: 50, y: 30 },
      to: { x: 100, y: 30 },
    });
    expect(readGradient(r)!.type).toBe("radial");
  });

  it("readGradient returns null for a solid fill", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc);
    (r as unknown as paper.Path).fillColor = new doc.scope.Color(1, 0, 0);
    expect(readGradient(r)).toBeNull();
  });

  it("defaultGradient spans the item bounds white→black", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc);
    const g = defaultGradient(r);
    expect(g.stops[0].color).toBe("#ffffff");
    expect(g.stops[1].color).toBe("#000000");
    expect(g.from.x).toBeCloseTo(0, 3);
    expect(g.to.x).toBeCloseTo(100, 3);
  });
});
