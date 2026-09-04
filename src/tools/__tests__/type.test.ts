import { describe, it, expect } from "vitest";
import { createDocument, activeLayerItemCount } from "@/engine/document";
import { TypeTool } from "../type";

describe("TypeTool", () => {
  it("clicking creates an editable PointText", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    expect(t.editing).not.toBeNull();
    expect(t.editing!.className).toBe("PointText");
    expect(t.isEditing).toBe(true);
  });

  it("keyInput types printable characters", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    t.keyInput("i");
    expect(t.editing!.content).toBe("Hi");
  });

  it("Backspace deletes the last character", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.keyInput("Backspace");
    expect(t.editing!.content).toBe("A");
  });

  it("Enter inserts a newline", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("Enter");
    t.keyInput("B");
    expect(t.editing!.content).toBe("A\nB");
  });

  it("setFontSize / setFontFamily change the editing text", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.setFontSize(40);
    t.setFontFamily("serif");
    expect(t.editing!.fontSize).toBe(40);
    expect(t.editing!.fontFamily).toBe("serif");
  });

  it("finish removes an empty text object", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.finish();
    expect(activeLayerItemCount(doc)).toBe(0);
    expect(t.editing).toBeNull();
  });

  it("finish keeps a non-empty text object and returns it", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    const kept = t.finish();
    expect(activeLayerItemCount(doc)).toBe(1);
    expect(t.editing).toBeNull();
    expect(kept).not.toBeNull();
    expect(kept!.content).toBe("H");
  });

  it("finish returns null for an empty (removed) text object", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    expect(t.finish()).toBeNull();
  });

  it("caret starts at 0 and advances as you type", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    expect(t.caret).toBe(0);
    t.keyInput("A");
    t.keyInput("B");
    expect(t.caret).toBe(2);
  });

  it("inserts at the caret after moving it left", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.moveCaret(-1); // caret between A and B
    t.keyInput("X");
    expect(t.editing!.content).toBe("AXB");
    expect(t.caret).toBe(2);
  });

  it("Backspace deletes the character before the caret (middle)", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.keyInput("C");
    t.moveCaret(-1); // caret between B and C
    t.keyInput("Backspace"); // removes B
    expect(t.editing!.content).toBe("AC");
    expect(t.caret).toBe(1);
  });

  it("caret clamps within bounds", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.moveCaret(-1);
    t.moveCaret(-1); // clamp at 0
    expect(t.caret).toBe(0);
    t.moveCaret(1);
    t.moveCaret(1); // clamp at length 1
    expect(t.caret).toBe(1);
  });

  it("selectAll selects the full range", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    t.keyInput("i");
    t.selectAll();
    expect(t.hasSelection).toBe(true);
    expect(t.selectionRange).toEqual({ start: 0, end: 2 });
    expect(t.selectedText).toBe("Hi");
  });

  it("typing a character replaces the selection", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    t.keyInput("i");
    t.selectAll();
    t.keyInput("X");
    expect(t.editing!.content).toBe("X");
    expect(t.hasSelection).toBe(false);
    expect(t.caret).toBe(1);
  });

  it("Backspace with a selection deletes the selection instead of one char", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.keyInput("C");
    t.selectAll();
    t.keyInput("Backspace");
    expect(t.editing!.content).toBe("");
    expect(t.hasSelection).toBe(false);
  });

  it("insertText replaces an active selection", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.keyInput("C");
    t.selectAll();
    t.insertText("xyz");
    expect(t.editing!.content).toBe("xyz");
    expect(t.caret).toBe(3);
  });

  it("moveCaret with extend=true grows a selection, plain move collapses it", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("A");
    t.keyInput("B");
    t.keyInput("C");
    // caret at 3; extend left twice -> selects "BC"
    t.moveCaret(-1, true);
    t.moveCaret(-1, true);
    expect(t.selectedText).toBe("BC");
    t.moveCaret(-1); // plain move collapses selection
    expect(t.hasSelection).toBe(false);
  });

  it("plain arrow collapses a selection to its edge, not one step from the caret", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    t.keyInput("i");
    t.selectAll(); // anchor 0, caret 2
    t.moveCaret(-1); // ArrowLeft → collapse to selection START
    expect(t.hasSelection).toBe(false);
    expect(t.caret).toBe(0);

    t.selectAll();
    t.moveCaret(1); // ArrowRight → collapse to selection END
    expect(t.hasSelection).toBe(false);
    expect(t.caret).toBe(2);
  });

  it("text exports to SVG", () => {
    const doc = createDocument(300, 300);
    const t = new TypeTool(doc);
    t.pointerDown({ x: 20, y: 50 });
    t.keyInput("H");
    t.keyInput("i");
    const svg = doc.project.exportSVG({ asString: true }) as string;
    expect(/<text/i.test(svg)).toBe(true);
  });
});
