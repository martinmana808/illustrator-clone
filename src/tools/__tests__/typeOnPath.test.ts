import { describe, it, expect } from "vitest";
import type paper from "paper";
import { createDocument } from "@/engine/document";
import { TypeOnPathTool } from "../typeOnPath";

function makeLine(doc: ReturnType<typeof createDocument>) {
  const line = new doc.scope.Path([
    [10, 100],
    [190, 100],
  ]) as unknown as paper.Path;
  line.strokeColor = new doc.scope.Color(0, 0, 0);
  return line;
}

describe("TypeOnPathTool", () => {
  it("attaches to a clicked path and enters editing", () => {
    const doc = createDocument(200, 200);
    makeLine(doc);
    const tool = new TypeOnPathTool(doc, () => 12);
    tool.pointerDown({ x: 100, y: 100 }); // on the stroke
    expect(tool.isEditing).toBe(true);
  });

  it("types glyphs along the path", () => {
    const doc = createDocument(200, 200);
    makeLine(doc);
    const tool = new TypeOnPathTool(doc, () => 12);
    tool.pointerDown({ x: 100, y: 100 });
    tool.keyInput("H");
    tool.keyInput("i");
    expect(tool.text).toBe("Hi");
    expect(tool.glyphGroup!.children.length).toBe(2);
    // First glyph sits at the start of the line (x≈10).
    const first = tool.glyphGroup!.children[0] as unknown as paper.PointText;
    expect(first.content).toBe("H");
  });

  it("hides the baseline stroke while text is attached", () => {
    const doc = createDocument(200, 200);
    const line = makeLine(doc);
    const tool = new TypeOnPathTool(doc, () => 12);
    tool.pointerDown({ x: 100, y: 100 });
    tool.keyInput("A");
    expect(line.strokeColor).toBeNull();
  });

  it("finish restores the stroke and removes empty text", () => {
    const doc = createDocument(200, 200);
    const line = makeLine(doc);
    const tool = new TypeOnPathTool(doc, () => 12);
    tool.pointerDown({ x: 100, y: 100 });
    tool.finish(); // nothing typed
    expect(line.strokeColor).not.toBeNull();
    expect(tool.isEditing).toBe(false);
  });

  it("backspace removes the last glyph", () => {
    const doc = createDocument(200, 200);
    makeLine(doc);
    const tool = new TypeOnPathTool(doc, () => 12);
    tool.pointerDown({ x: 100, y: 100 });
    tool.keyInput("A");
    tool.keyInput("B");
    tool.keyInput("Backspace");
    expect(tool.text).toBe("A");
    expect(tool.glyphGroup!.children.length).toBe(1);
  });
});
