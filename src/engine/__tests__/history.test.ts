import { describe, it, expect } from "vitest";
import { createDocument, addRectangle, activeLayerItemCount } from "@/engine/document";
import { History } from "../history";

describe("History", () => {
  it("undo removes the last change; redo restores it", () => {
    const doc = createDocument(200, 200);
    const h = new History(doc);
    addRectangle(doc, 0, 0, 10, 10);
    h.capture();
    expect(activeLayerItemCount(doc)).toBe(1);
    expect(h.undo()).toBe(true);
    expect(activeLayerItemCount(doc)).toBe(0);
    expect(h.redo()).toBe(true);
    expect(activeLayerItemCount(doc)).toBe(1);
  });

  it("capture dedupes identical states", () => {
    const doc = createDocument(200, 200);
    const h = new History(doc);
    h.capture(); // no change since construction
    expect(h.canUndo()).toBe(false);
  });

  it("canUndo/canRedo reflect position", () => {
    const doc = createDocument(200, 200);
    const h = new History(doc);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    addRectangle(doc, 0, 0, 10, 10);
    h.capture();
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
    h.undo();
    expect(h.canRedo()).toBe(true);
  });

  it("a new capture after undo truncates the redo future", () => {
    const doc = createDocument(200, 200);
    const h = new History(doc);
    addRectangle(doc, 0, 0, 10, 10);
    h.capture();
    h.undo(); // back to empty
    addRectangle(doc, 50, 50, 20, 20); // different change
    h.capture();
    expect(h.canRedo()).toBe(false);
    expect(activeLayerItemCount(doc)).toBe(1);
  });

  it("multiple undos walk back through history", () => {
    const doc = createDocument(200, 200);
    const h = new History(doc);
    addRectangle(doc, 0, 0, 10, 10);
    h.capture();
    addRectangle(doc, 20, 20, 10, 10);
    h.capture();
    expect(activeLayerItemCount(doc)).toBe(2);
    h.undo();
    expect(activeLayerItemCount(doc)).toBe(1);
    h.undo();
    expect(activeLayerItemCount(doc)).toBe(0);
  });
});
