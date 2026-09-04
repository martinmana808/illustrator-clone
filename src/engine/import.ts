import type paper from "paper";
import type { EditorDoc } from "./document";

export interface ArtboardSize {
  width: number;
  height: number;
}

/** Name of the locked, dimmed layer that holds placed tracing images. */
export const TEMPLATE_LAYER = "Template";

/** Longest edge a placed image is downscaled to before it enters the document. */
export const MAX_IMAGE_DIM = 1600;

/** Opacity of the template layer, so traced artwork stays readable over it. */
export const TEMPLATE_OPACITY = 0.5;

function combinedBounds(items: paper.Item[]): paper.Rectangle | null {
  if (items.length === 0) return null;
  let b = items[0].bounds;
  for (let i = 1; i < items.length; i++) b = b.unite(items[i].bounds);
  return b;
}

/** Scale down (never up) and centre a set of items on the artboard. */
function fitOnArtboard(
  scope: paper.PaperScope,
  items: paper.Item[],
  artboard: ArtboardSize,
  margin = 0.9
): void {
  const b = combinedBounds(items);
  if (!b || b.width === 0 || b.height === 0) return;
  const scale = Math.min(
    1,
    (artboard.width * margin) / b.width,
    (artboard.height * margin) / b.height
  );
  // Scale every item about the *shared* centre so their relative layout holds.
  if (scale < 1) for (const it of items) it.scale(scale, b.center);

  const after = combinedBounds(items);
  if (!after) return;
  const delta = new scope.Point(artboard.width / 2, artboard.height / 2).subtract(after.center);
  for (const it of items) it.translate(delta);
}

/** Every non-group descendant of an item, so an imported SVG tree flattens. */
function leaves(item: paper.Item): paper.Item[] {
  if (item.className !== "Group" && item.className !== "Layer") return [item];
  const out: paper.Item[] = [];
  for (const child of [...item.children]) out.push(...leaves(child));
  return out;
}

/**
 * Import an SVG string and flatten it into the active layer.
 *
 * Paper bakes group transforms down into segment coordinates while
 * `settings.applyMatrix` is on (the default), so dropping the group wrappers
 * keeps the geometry put — and every path lands as a direct child of the layer
 * where Select, Direct Select and the Pathfinder can all reach it.
 */
export function importSVGString(
  doc: EditorDoc,
  svg: string,
  artboard: ArtboardSize
): paper.Item[] {
  const scope = doc.scope;
  scope.activate();
  const imported = doc.project.importSVG(svg, { expandShapes: true }) as paper.Item | null;
  if (!imported) return [];

  const layer = doc.project.activeLayer;
  const items = leaves(imported);
  for (const it of items) layer.addChild(it);
  imported.remove();

  fitOnArtboard(scope, items, artboard);
  doc.project.deselectAll();
  for (const it of items) it.selected = true;
  scope.view?.update?.();
  return items;
}

/** The locked, dimmed, bottom-most layer used for tracing images. */
export function templateLayer(doc: EditorDoc): paper.Layer {
  const existing = doc.project.layers.find((l) => l.name === TEMPLATE_LAYER);
  if (existing) return existing;
  const previous = doc.project.activeLayer;
  doc.scope.activate();
  const layer = new doc.scope.Layer();
  layer.name = TEMPLATE_LAYER;
  layer.sendToBack();
  previous?.activate();
  return layer;
}

/**
 * Detach template layers for the duration of an export and return a function
 * that puts them back where they were. A tracing image is scaffolding, not
 * artwork — Illustrator's template layers are non-printing for the same
 * reason. Saving the document still keeps it, so it is there next time.
 *
 * They are detached rather than hidden because Paper exports an invisible item
 * as `visibility="hidden"` instead of omitting it, which would bury the
 * image's whole base64 payload in every exported SVG.
 */
export function hideTemplates(doc: EditorDoc): () => void {
  const detached = doc.project.layers
    .filter((l) => l.name === TEMPLATE_LAYER)
    .map((layer) => ({ layer, index: layer.index }));
  for (const { layer } of detached) layer.remove();
  return () => {
    // Back to front, so each layer lands on the index it was taken from.
    for (const { layer, index } of detached) doc.project.insertLayer(index, layer);
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image"));
    img.src = src;
  });
}

/**
 * Redraw the image at most `MAX_IMAGE_DIM` on its long edge. History snapshots
 * the whole project as JSON and Paper serializes a raster's pixels inline, so
 * an un-capped image would be copied into every undo step.
 */
function downscale(img: HTMLImageElement, max = MAX_IMAGE_DIM): HTMLCanvasElement {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > max ? max / longest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Place a bitmap as a tracing template: downscaled, centred on the artboard,
 * on its own dimmed layer at the back. The layer is locked, and Paper skips
 * locked items when hit-testing, so the Pen and Selection tools click straight
 * through it onto whatever you are drawing.
 */
export async function importImage(
  doc: EditorDoc,
  dataUrl: string,
  artboard: ArtboardSize
): Promise<paper.Raster> {
  const img = await loadImage(dataUrl);
  const scope = doc.scope;
  scope.activate();

  const layer = templateLayer(doc);
  layer.locked = false; // adding to a locked layer is fine, but keep it explicit
  const raster = new scope.Raster(downscale(img));
  layer.addChild(raster);
  raster.position = new scope.Point(artboard.width / 2, artboard.height / 2);
  fitOnArtboard(scope, [raster], artboard, 1);

  layer.opacity = TEMPLATE_OPACITY;
  layer.locked = true;
  layer.sendToBack();
  raster.selected = false;
  scope.view?.update?.();
  return raster;
}
