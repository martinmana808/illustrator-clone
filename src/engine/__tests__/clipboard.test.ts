import { describe, it, expect, beforeEach } from "vitest";
import type paper from "paper";
import { createDocument, addRectangle, activeLayerItemCount } from "@/engine/document";
import { copyItems, pasteItems, getClipboard, setClipboard } from "../clipboard";

describe("clipboard", () => {
  beforeEach(() => setClipboard(null));

  it("copyItems stores serialized objects", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10);
    copyItems([r]);
    const cb = getClipboard();
    expect(cb?.type).toBe("objects");
    expect(cb && cb.type === "objects" ? cb.items.length : 0).toBe(1);
  });

  it("copyItems with no items is a no-op", () => {
    copyItems([]);
    expect(getClipboard()).toBeNull();
  });

  it("pasteItems adds offset clones and selects them", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 10, 10, 20, 20) as unknown as paper.Path;
    r.fillColor = new doc.scope.Color(1, 0, 0);
    copyItems([r]);

    const pasted = pasteItems(doc);
    expect(pasted.length).toBe(1);
    expect(activeLayerItemCount(doc)).toBe(2);
    expect(pasted[0].selected).toBe(true);
    expect((pasted[0] as unknown as paper.Path).fillColor!.toCSS(true)).toBe("#ff0000");
    // Offset from the original.
    expect(pasted[0].bounds.left).toBeCloseTo(22, 3);
    expect(pasted[0].bounds.top).toBeCloseTo(22, 3);
  });

  it("pasteItems is a no-op when clipboard holds text or is empty", () => {
    const doc = createDocument(200, 200);
    expect(pasteItems(doc)).toEqual([]);
    setClipboard({ type: "text", content: "hi" });
    expect(pasteItems(doc)).toEqual([]);
  });

  it("repeated paste calls each offset from the original position", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 10, 10, 20, 20);
    copyItems([r]);
    pasteItems(doc);
    const second = pasteItems(doc);
    expect(second[0].bounds.left).toBeCloseTo(22, 3);
  });

  it("pasting a Group preserves all of its children", () => {
    const doc = createDocument(200, 200);
    const g = new doc.scope.Group([
      addRectangle(doc, 0, 0, 10, 10),
      addRectangle(doc, 20, 20, 10, 10),
    ]);
    copyItems([g]);
    const pasted = pasteItems(doc);
    expect(pasted.length).toBe(1);
    expect(pasted[0].className).toBe("Group");
    expect((pasted[0] as unknown as paper.Group).children.length).toBe(2);
  });

  it("copyItems drops descendants of other copied items (no double paste)", () => {
    const doc = createDocument(200, 200);
    const a = addRectangle(doc, 0, 0, 10, 10);
    const b = addRectangle(doc, 20, 20, 10, 10);
    const g = new doc.scope.Group([a, b]);
    // Paper's selectedItems reports the group AND its children.
    copyItems([g, a, b]);
    const pasted = pasteItems(doc);
    expect(pasted.length).toBe(1);
    expect(pasted[0].className).toBe("Group");
  });
});
