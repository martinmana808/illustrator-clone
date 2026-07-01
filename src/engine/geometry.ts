import paper from "paper";

/** Absolute area of a path, independent of winding direction. */
export function pathArea(path: paper.Path): number {
  return Math.abs(path.area);
}

/** Number of anchor points (segments) on a path. */
export function segmentCount(path: paper.Path): number {
  return path.segments.length;
}

/** Whether the path is closed. */
export function isClosed(path: paper.Path): boolean {
  return path.closed;
}

/** Deep clone that is not inserted into the active layer. */
export function clonePath(path: paper.Path): paper.Path {
  return path.clone({ insert: false }) as paper.Path;
}
