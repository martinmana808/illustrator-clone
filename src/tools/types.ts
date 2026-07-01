export interface Vec {
  x: number;
  y: number;
}

export interface Modifiers {
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
}

export type PenCursor = "pen" | "add" | "delete" | "close" | "corner" | "continue";

import type { PathfinderOp } from "@/engine/pathfinder";
import type { LayerInfo } from "@/engine/layers";
import type { StyleSummary } from "@/engine/style";

/** Handle the canvas exposes to React panels for actions on live geometry. */
export interface ToolController {
  teardown: () => void;
  runPathfinder: (op: PathfinderOp) => void;
  setFill(css: string | null): void;
  setStroke(css: string | null): void;
  setStrokeWidth(w: number): void;
  readSelectionStyle(): StyleSummary;
  layers(): LayerInfo[];
  addLayer(name?: string): void;
  renameLayer(id: number, name: string): void;
  toggleLayerVisible(id: number): void;
  toggleLayerLocked(id: number): void;
  moveLayer(id: number, dir: -1 | 1): void;
  exportSVG(): void;
  exportPNG(): void;
  save(): void;
  open(json: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  onChange(cb: () => void): () => void;
}
