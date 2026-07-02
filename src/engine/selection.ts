import type paper from "paper";

export type SelectionKind = "none" | "text" | "shape" | "mixed";

/** Classify a selection so the UI can show contextual panels. */
export function selectionKind(items: paper.Item[]): SelectionKind {
  if (items.length === 0) return "none";
  let hasText = false;
  let hasShape = false;
  for (const it of items) {
    if (it.className === "PointText") hasText = true;
    else hasShape = true;
  }
  if (hasText && hasShape) return "mixed";
  return hasText ? "text" : "shape";
}
