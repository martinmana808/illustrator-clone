import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle } from "@/engine/document";
import { selectionKind } from "../selection";

describe("selectionKind", () => {
  it("none for empty", () => {
    expect(selectionKind([])).toBe("none");
  });

  it("shape for paths", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10) as unknown as paper.Item;
    expect(selectionKind([r])).toBe("shape");
  });

  it("text for PointText", () => {
    const doc = createDocument(200, 200);
    const t = new doc.scope.PointText({ point: [10, 10], content: "hi" }) as unknown as paper.Item;
    expect(selectionKind([t])).toBe("text");
  });

  it("mixed for text + shape", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10) as unknown as paper.Item;
    const t = new doc.scope.PointText({ point: [10, 10], content: "hi" }) as unknown as paper.Item;
    expect(selectionKind([r, t])).toBe("mixed");
  });
});
