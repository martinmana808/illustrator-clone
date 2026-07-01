import { describe, it, expect } from "vitest";
import { createDocument, addRectangle, activeLayerItemCount } from "@/engine/document";
import { serializeDocument, loadDocument } from "../persist";
import { pathArea } from "../geometry";
import type paper from "paper";

describe("persist", () => {
  it("round-trips a document through serialize/load", () => {
    const doc = createDocument(200, 200);
    addRectangle(doc, 0, 0, 10, 10);
    addRectangle(doc, 20, 20, 30, 30);
    const json = serializeDocument(doc);

    const doc2 = createDocument(200, 200);
    loadDocument(doc2, json);
    expect(activeLayerItemCount(doc2)).toBe(2);
    const first = doc2.project.activeLayer.children[0] as unknown as paper.Path;
    expect(pathArea(first)).toBeCloseTo(100, 3);
  });

  it("loading replaces existing content", () => {
    const empty = serializeDocument(createDocument(200, 200));
    const doc = createDocument(200, 200);
    addRectangle(doc, 0, 0, 10, 10);
    expect(activeLayerItemCount(doc)).toBe(1);
    loadDocument(doc, empty);
    expect(activeLayerItemCount(doc)).toBe(0);
  });

  it("preserves fill color through a round-trip", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10) as unknown as paper.Path;
    r.fillColor = new doc.scope.Color(1, 0, 0);
    const json = serializeDocument(doc);
    const doc2 = createDocument(200, 200);
    loadDocument(doc2, json);
    const loaded = doc2.project.activeLayer.children[0] as unknown as paper.Path;
    expect(loaded.fillColor).not.toBeNull();
    expect(loaded.fillColor!.toCSS(true)).toBe("#ff0000");
  });
});
