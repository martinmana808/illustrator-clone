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
import type { StrokeAlign } from "@/engine/strokeAlign";

/** Handle the canvas exposes to React panels for actions on live geometry. */
export interface ToolController {
  teardown: () => void;
  runPathfinder: (op: PathfinderOp) => void;
  setFill(css: string | null): void;
  setStroke(css: string | null): void;
  setStrokeWidth(w: number): void;
  setStrokeAlign(a: StrokeAlign): void;
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
  placeSVG(svg: string): void;
  placeImage(dataUrl: string): Promise<void>;
  typeKey(key: string): void;
  caretMove(dir: -1 | 1, extend?: boolean): void;
  setTextContent(s: string): void;
  finishTyping(): void;
  isTyping(): boolean;
  hasTextSelection(): boolean;
  selectAllInContext(): void;
  copySelection(): void;
  cutSelection(): void;
  pasteClipboard(): void;
  setFontSize(n: number): void;
  setFontFamily(f: string): void;
  readText(): { content: string; fontSize: number; fontFamily: string } | null;
  readSelectedText(): { content: string; fontSize: number; fontFamily: string } | null;
  setSelectedTextContent(s: string): void;
  setSelectedFontSize(n: number): void;
  setSelectedFontFamily(f: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(z: number): void;
  fitArtboard(): void;
  actualSize(): void;
  zoomAtClient(clientX: number, clientY: number, factor: number): void;
  panBy(dx: number, dy: number): void;
  getZoom(): number;
  shapeArrow(key: string): void;
  isDrawingShape(): boolean;
  readSelectionGradient(): import("@/engine/gradients").GradientDesc | null;
  setGradientType(type: "linear" | "radial"): void;
  setGradientStops(stops: import("@/engine/gradients").GradientStop[]): void;
  applyDefaultGradient(): void;
  onChange(cb: () => void): () => void;
}
