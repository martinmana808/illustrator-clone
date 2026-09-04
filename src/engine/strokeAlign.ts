import type paper from "paper";
import type { EditorDoc } from "./document";

export type StrokeAlign = "middle" | "inside" | "outside";

export const STROKE_ALIGNS: StrokeAlign[] = ["middle", "inside", "outside"];

type Strokeable = paper.Item & {
  fillColor: paper.Color | null;
  strokeColor: paper.Color | null;
  strokeWidth: number;
};

/**
 * Inside/outside stroke is undefined without an interior, so it only applies to
 * closed paths and compound paths. Everything else (open paths, text, rasters,
 * groups) reports and renders as "middle" — the same thing Illustrator does by
 * greying the buttons out for open paths.
 */
export function supportsStrokeAlign(item: paper.Item): boolean {
  if (item.data?.isChrome) return false;
  if (item.className === "CompoundPath") return true;
  if (item.className !== "Path") return false;
  return (item as paper.Path).closed === true;
}

/** The alignment stored on an item, defaulting to "middle". */
export function strokeAlignOf(item: paper.Item): StrokeAlign {
  const a = item.data?.strokeAlign;
  return a === "inside" || a === "outside" ? a : "middle";
}

/**
 * Store the alignment on the item itself. Paper serializes `data` in
 * exportJSON, so this rides along with undo/redo, Save and Open for free.
 */
export function applyStrokeAlign(items: paper.Item[], align: StrokeAlign): void {
  for (const it of items) {
    if (!supportsStrokeAlign(it)) continue;
    if (align === "middle") delete it.data.strokeAlign;
    else it.data.strokeAlign = align;
  }
}

/** Common alignment across items, or null when they disagree / none qualify. */
export function readStrokeAlign(items: paper.Item[]): StrokeAlign | null {
  const eligible = items.filter(supportsStrokeAlign);
  if (eligible.length === 0) return null;
  const first = strokeAlignOf(eligible[0]);
  return eligible.every((it) => strokeAlignOf(it) === first) ? first : null;
}

/**
 * Paper treats a fully transparent stroke as *no* stroke (`Style#hasStroke`
 * requires `alpha > 0`), which would stop clicks landing on a stroke while an
 * inside/outside alignment is showing. So hide the real stroke with an alpha
 * below one 8-bit level instead of zero: invisible on screen and in exports,
 * but still a stroke as far as hit-testing is concerned.
 */
const HIDDEN_STROKE_ALPHA = 1 / 512;

function hidden(scope: paper.PaperScope, color: paper.Color): paper.Color {
  const c = new scope.Color(color);
  c.alpha = HIDDEN_STROKE_ALPHA;
  return c;
}

/**
 * A clipped group that paints `item`'s stroke on one side of its outline only.
 *
 * There is no stroke alignment in canvas or SVG 1.1 — stroke is always
 * centered — so we stroke at double width and clip away the half we don't
 * want: to the path's own interior for "inside", to everything outside it
 * (a bounds rectangle minus the path) for "outside".
 */
export function alignedStrokeGroup(
  scope: paper.PaperScope,
  item: paper.Item,
  align: StrokeAlign
): paper.Group | null {
  if (align === "middle" || !supportsStrokeAlign(item)) return null;
  const styled = item as Strokeable;
  const width = styled.strokeWidth;
  if (!styled.strokeColor || !width || width <= 0) return null;

  const outline = item.clone({ insert: false }) as Strokeable;
  outline.fillColor = null;
  outline.strokeWidth = width * 2;
  outline.selected = false;
  outline.data = { isChrome: true };

  let mask: paper.Item;
  if (align === "inside") {
    mask = item.clone({ insert: false });
  } else {
    // Only needs to cover the stroked outline, so it stays independent of the
    // current zoom and pan.
    const around = new scope.Path.Rectangle(item.bounds.expand(width * 4));
    around.remove();
    mask = around.subtract(item as paper.PathItem, { insert: false });
  }
  const maskStyle = mask as Strokeable;
  maskStyle.strokeColor = null;
  maskStyle.fillColor = null;
  mask.selected = false;
  mask.clipMask = true;
  mask.data = { isChrome: true };

  const group = new scope.Group([mask, outline]);
  group.data.isChrome = true;
  return group;
}

/**
 * Render every non-middle stroke in the document, and return a function that
 * undoes it. The item's own stroke is made transparent rather than removed, so
 * `hasStroke()` stays true and clicking on a stroke still hit-tests.
 *
 * Callers must restore before anything that serializes (history capture, save,
 * export), or the clip groups end up in the document.
 */
export function applyStrokeAlignVisuals(doc: EditorDoc): () => void {
  const scope = doc.scope;
  scope.activate();
  const groups: paper.Item[] = [];
  const hiddenStrokes: Array<[Strokeable, paper.Color]> = [];

  for (const layer of doc.project.layers) {
    if (!layer.visible) continue;
    for (const item of [...layer.children]) {
      const align = strokeAlignOf(item);
      if (align === "middle") continue;
      const group = alignedStrokeGroup(scope, item, align);
      if (!group) continue;
      group.insertAbove(item);
      groups.push(group);
      const styled = item as Strokeable;
      hiddenStrokes.push([styled, styled.strokeColor as paper.Color]);
      styled.strokeColor = hidden(scope, styled.strokeColor as paper.Color);
    }
  }

  return () => {
    for (const g of groups) g.remove();
    for (const [item, color] of hiddenStrokes) item.strokeColor = color;
  };
}
