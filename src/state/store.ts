import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { ToolController } from "@/tools/types";

export type ToolId =
  | "select"
  | "direct-select"
  | "anchor-point"
  | "pen"
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "polygon"
  | "star"
  | "line"
  | "type"
  | "type-on-path"
  | "zoom"
  | "hand";

export interface EditorState {
  activeTool: ToolId;
  selectionCount: number;
  zoom: number;
  controller: ToolController | null;
  setTool(t: ToolId): void;
  setSelectionCount(n: number): void;
  setZoom(z: number): void;
  setController(c: ToolController | null): void;
}

export const editorStore = createStore<EditorState>((set) => ({
  activeTool: "select",
  selectionCount: 0,
  zoom: 1,
  controller: null,
  setTool: (t) => set({ activeTool: t }),
  setSelectionCount: (n) => set({ selectionCount: n }),
  setZoom: (z) => set({ zoom: z }),
  setController: (c) => set({ controller: c }),
}));

export function useEditorStore<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore, selector);
}
