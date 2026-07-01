import { describe, it, expect, beforeEach } from "vitest";
import { editorStore } from "../store";

describe("editor store", () => {
  beforeEach(() => {
    editorStore.getState().setTool("select");
    editorStore.getState().setSelectionCount(0);
  });

  it("defaults to the select tool", () => {
    expect(editorStore.getState().activeTool).toBe("select");
  });

  it("switches tool", () => {
    editorStore.getState().setTool("pen");
    expect(editorStore.getState().activeTool).toBe("pen");
  });

  it("tracks selection count", () => {
    editorStore.getState().setSelectionCount(3);
    expect(editorStore.getState().selectionCount).toBe(3);
  });
});
