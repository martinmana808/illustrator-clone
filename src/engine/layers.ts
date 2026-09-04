import type paper from "paper";
import type { EditorDoc } from "./document";

export interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
}

function findLayer(doc: EditorDoc, id: number): paper.Layer | undefined {
  return doc.project.layers.find((l) => l.id === id);
}

/**
 * Layers with the front-most (top) first, matching UI expectations. The
 * artboard chrome rides in a throwaway layer of its own, which is not the
 * user's to see or reorder.
 */
export function listLayers(doc: EditorDoc): LayerInfo[] {
  return doc.project.layers
    .filter((l) => !l.data?.isChrome)
    .map((l, i) => ({
      id: l.id,
      name: l.name || `Layer ${i + 1}`,
      visible: l.visible,
      locked: l.locked,
    }))
    .reverse();
}

export function addLayer(doc: EditorDoc, name?: string): paper.Layer {
  doc.scope.activate();
  const layer = new doc.scope.Layer();
  if (name) layer.name = name;
  layer.activate();
  return layer;
}

export function renameLayer(doc: EditorDoc, id: number, name: string): void {
  const l = findLayer(doc, id);
  if (l) l.name = name;
}

export function setLayerVisible(doc: EditorDoc, id: number, visible: boolean): void {
  const l = findLayer(doc, id);
  if (l) l.visible = visible;
}

export function setLayerLocked(doc: EditorDoc, id: number, locked: boolean): void {
  const l = findLayer(doc, id);
  if (l) l.locked = locked;
}

/** Move a layer up (+1, toward front) or down (-1) in z-order. */
export function moveLayer(doc: EditorDoc, id: number, dir: -1 | 1): void {
  const layers = doc.project.layers;
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const target = idx + dir;
  if (target < 0 || target >= layers.length) return;
  const layer = layers[idx];
  const sibling = layers[target];
  if (dir === 1) layer.insertAbove(sibling);
  else layer.insertBelow(sibling);
}
