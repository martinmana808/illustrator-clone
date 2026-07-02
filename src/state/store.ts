import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { ToolController } from "@/tools/types";

export type ToolId =
  | "select"
  | "direct-select"
  | "anchor-point"
  | "pen"
  | "type"
  | "type-on-path";

export interface EditorState {
  activeTool: ToolId;
  selectionCount: number;
  controller: ToolController | null;
  setTool(t: ToolId): void;
  setSelectionCount(n: number): void;
  setController(c: ToolController | null): void;
}

export const editorStore = createStore<EditorState>((set) => ({
  activeTool: "select",
  selectionCount: 0,
  controller: null,
  setTool: (t) => set({ activeTool: t }),
  setSelectionCount: (n) => set({ selectionCount: n }),
  setController: (c) => set({ controller: c }),
}));

export function useEditorStore<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore, selector);
}
