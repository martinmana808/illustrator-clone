import type paper from "paper";
import type { EditorDoc } from "@/engine/document";

export interface HitOptions {
  fill?: boolean;
  stroke?: boolean;
  segments?: boolean;
}

/**
 * Hit-test the document at a point, with a text-friendly fallback: plain
 * fill/stroke hit-testing only matches literal glyph ink, so a click in the
 * whitespace between baseline and cap-height (which a user still perceives
 * as "on the text") misses. When the normal hit-test finds nothing, fall
 * back to checking PointText items' own (tolerance-padded) bounds.
 */
export function hitTestItem(
  doc: EditorDoc,
  pt: paper.Point,
  tolerance: number,
  options: HitOptions = { fill: true, stroke: true }
): paper.Item | null {
  const hit = doc.project.hitTest(pt, {
    ...options,
    tolerance,
    // Never match artboard chrome, even when a caller forgot to strip overlays.
    match: (r: paper.HitResult) => !r.item?.data?.isChrome,
  });
  if (hit && hit.item) return hit.item;

  // Match project.hitTest semantics: all layers, topmost first, skipping
  // hidden/locked layers and the artboard chrome.
  const layers = doc.project.layers;
  for (let li = layers.length - 1; li >= 0; li--) {
    const layer = layers[li];
    if (!layer.visible || layer.locked) continue;
    const kids = layer.children;
    for (let i = kids.length - 1; i >= 0; i--) {
      const c = kids[i];
      if (c.className !== "PointText" || c.data?.isChrome) continue;
      if (c.bounds.expand(tolerance * 2).contains(pt)) return c;
    }
  }
  return null;
}
