import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { applyFill, applyStroke, applyStrokeWidth, readStyle } from "../style";

function rect(doc: ReturnType<typeof createDocument>, x: number, y: number, w: number, h: number) {
  return addRectangle(doc, x, y, w, h) as unknown as paper.Item;
}

describe("style helpers", () => {
  it("applyFill sets fillColor and readStyle reports it", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc, 0, 0, 10, 10);
    applyFill([r], "#ff0000");
    expect((r as unknown as paper.Path).fillColor).not.toBeNull();
    expect(readStyle([r]).fill).toBe("#ff0000");
  });

  it("applyStroke + width set stroke props", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc, 0, 0, 10, 10);
    applyStroke([r], "#0000ff");
    applyStrokeWidth([r], 3);
    const s = readStyle([r]);
    expect(s.stroke).toBe("#0000ff");
    expect(s.strokeWidth).toBe(3);
  });

  it("readStyle returns null fill when items disagree", () => {
    const doc = createDocument(200, 200);
    const a = rect(doc, 0, 0, 10, 10);
    const b = rect(doc, 20, 20, 10, 10);
    applyFill([a], "#ff0000");
    applyFill([b], "#00ff00");
    expect(readStyle([a, b]).fill).toBeNull();
  });

  it("applyFill(null) clears the fill", () => {
    const doc = createDocument(200, 200);
    const r = rect(doc, 0, 0, 10, 10);
    applyFill([r], "#ff0000");
    applyFill([r], null);
    expect((r as unknown as paper.Path).fillColor).toBeNull();
  });
});
