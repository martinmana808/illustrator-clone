import { describe, it, expect } from "vitest";
import paper from "paper";
import { createDocument } from "../document";
import {
  applyStrokeAlign,
  applyStrokeAlignVisuals,
  readStrokeAlign,
  strokeAlignOf,
  supportsStrokeAlign,
} from "../strokeAlign";
import { readStyle } from "../style";

function doc() {
  return createDocument(400, 400);
}

function strokedRect(d: ReturnType<typeof doc>, size = 100) {
  const p = new d.scope.Path.Rectangle({ point: [100, 100], size: [size, size] });
  p.fillColor = new d.scope.Color(1, 0, 0);
  p.strokeColor = new d.scope.Color(0, 0, 0);
  p.strokeWidth = 10;
  return p;
}

describe("stroke alignment", () => {
  it("only applies to closed paths", () => {
    const d = doc();
    const rect = strokedRect(d);
    const line = new d.scope.Path.Line(new d.scope.Point(0, 0), new d.scope.Point(10, 10));
    const text = new d.scope.PointText(new d.scope.Point(5, 5));

    expect(supportsStrokeAlign(rect)).toBe(true);
    expect(supportsStrokeAlign(line)).toBe(false);
    expect(supportsStrokeAlign(text)).toBe(false);

    applyStrokeAlign([rect, line, text], "inside");
    expect(strokeAlignOf(rect)).toBe("inside");
    expect(strokeAlignOf(line)).toBe("middle");
    expect(strokeAlignOf(text)).toBe("middle");
  });

  it("survives a JSON round-trip, so undo/save carry it", () => {
    const d = doc();
    applyStrokeAlign([strokedRect(d)], "outside");
    const json = d.project.exportJSON();
    d.project.clear();
    d.project.importJSON(json);
    expect(strokeAlignOf(d.project.layers[0].children[0])).toBe("outside");
  });

  it("reports a common alignment, or null when items disagree", () => {
    const d = doc();
    const a = strokedRect(d);
    const b = strokedRect(d);
    expect(readStrokeAlign([a, b])).toBe("middle");
    applyStrokeAlign([a, b], "inside");
    expect(readStrokeAlign([a, b])).toBe("inside");
    applyStrokeAlign([b], "outside");
    expect(readStrokeAlign([a, b])).toBeNull();
    expect(readStrokeAlign([])).toBeNull();
  });

  it("surfaces the alignment through readStyle", () => {
    const d = doc();
    const rect = strokedRect(d);
    applyStrokeAlign([rect], "inside");
    expect(readStyle([rect]).strokeAlign).toBe("inside");
  });

  it("clips an inside stroke to the shape's own outline", () => {
    const d = doc();
    const rect = strokedRect(d);
    applyStrokeAlign([rect], "inside");
    applyStrokeAlignVisuals(d);

    const group = d.project.layers[0].children.find((c) => c.className === "Group");
    expect(group).toBeDefined();
    const [mask, outline] = (group as paper.Group).children;
    expect(mask.clipMask).toBe(true);
    // The clip is the path itself, so the visible stroke never leaves its bounds.
    expect(mask.bounds.width).toBeCloseTo(100, 5);
    expect((mask as paper.Path).contains(rect.bounds.center)).toBe(true);
    expect((outline as paper.Path).strokeWidth).toBe(20);
    expect((group as paper.Group).bounds.width).toBeCloseTo(100, 5);
  });

  it("clips an outside stroke to everything but the shape", () => {
    const d = doc();
    const rect = strokedRect(d);
    applyStrokeAlign([rect], "outside");
    applyStrokeAlignVisuals(d);

    const group = d.project.layers[0].children.find(
      (c) => c.className === "Group"
    ) as paper.Group;
    const [mask, outline] = group.children;
    expect(mask.clipMask).toBe(true);
    // Bounds-rect minus the path leaves a hole, so the mask is compound.
    expect(mask.className).toBe("CompoundPath");
    // The clip keeps everything *but* the shape's interior.
    const inner = mask as paper.CompoundPath;
    expect(inner.contains(rect.bounds.center)).toBe(false);
    expect(inner.contains(new d.scope.Point(rect.bounds.left - 5, rect.bounds.center.y))).toBe(
      true
    );
    // Double-width stroke, so the visible half spans the full weight outward.
    expect((outline as paper.Path).strokeBounds.width).toBeCloseTo(120, 5);
  });

  it("hides the item's own stroke without losing hit-testability", () => {
    const d = doc();
    const rect = strokedRect(d);
    applyStrokeAlign([rect], "inside");
    applyStrokeAlignVisuals(d);

    expect(rect.strokeColor).not.toBeNull();
    // Invisible (below one 8-bit level) but still a stroke, so clicking the
    // stroke of an unfilled shape keeps working.
    expect(rect.strokeColor!.alpha).toBeLessThan(1 / 255);
    expect(rect.hasStroke()).toBe(true);
  });

  it("restores the document exactly, so snapshots stay clean", () => {
    const d = doc();
    const rect = strokedRect(d);
    applyStrokeAlign([rect], "outside");
    const before = d.project.exportJSON();

    const restore = applyStrokeAlignVisuals(d);
    expect(d.project.layers[0].children.length).toBe(2);
    restore();

    expect(d.project.layers[0].children.length).toBe(1);
    expect(d.project.exportJSON()).toBe(before);
  });

  it("leaves middle-aligned and unstroked shapes untouched", () => {
    const d = doc();
    strokedRect(d); // middle by default
    const noStroke = new d.scope.Path.Rectangle({ point: [0, 0], size: [10, 10] });
    applyStrokeAlign([noStroke], "inside");

    const restore = applyStrokeAlignVisuals(d);
    expect(d.project.layers[0].children.filter((c) => c.className === "Group")).toHaveLength(0);
    restore();
  });
});
