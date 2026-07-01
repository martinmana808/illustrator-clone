import paper from "paper";

type Transformable = paper.Item;

/** Scale items by (sx, sy) about a pivot point. */
export function scaleItems(
  items: Transformable[],
  sx: number,
  sy: number,
  cx: number,
  cy: number
): void {
  const c = new paper.Point(cx, cy);
  for (const it of items) it.scale(sx, sy, c);
}

/** Rotate items by `deg` degrees about a center point. */
export function rotateItems(
  items: Transformable[],
  deg: number,
  cx: number,
  cy: number
): void {
  const c = new paper.Point(cx, cy);
  for (const it of items) it.rotate(deg, c);
}

/** Translate items by (dx, dy). */
export function translateItems(items: Transformable[], dx: number, dy: number): void {
  const d = new paper.Point(dx, dy);
  for (const it of items) it.translate(d);
}
