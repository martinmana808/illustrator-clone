import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type ToolId = "select" | "direct-select" | "pen";

export interface EditorState {
  activeTool: ToolId;
  selectionCount: number;
  setTool(t: ToolId): void;
  setSelectionCount(n: number): void;
}

export const editorStore = createStore<EditorState>((set) => ({
  activeTool: "select",
  selectionCount: 0,
  setTool: (t) => set({ activeTool: t }),
  setSelectionCount: (n) => set({ selectionCount: n }),
}));

export function useEditorStore<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore, selector);
}
