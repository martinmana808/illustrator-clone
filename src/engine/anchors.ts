import paper from "paper";
import type { Vec } from "@/tools/types";

const EPS = 1e-6;

/** A corner point has (effectively) no handles. */
export function isCorner(seg: paper.Segment): boolean {
  return seg.handleIn.length < 1e-4 && seg.handleOut.length < 1e-4;
}

/** A smooth point has two non-zero, collinear-and-opposite handles. */
export function isSmooth(seg: paper.Segment): boolean {
  if (seg.handleIn.length < 1e-4 || seg.handleOut.length < 1e-4) return false;
  const inv = seg.handleOut.multiply(-1);
  return Math.abs(seg.handleIn.getAngle(inv)) < 1; // within 1 degree
}

/** Collapse a segment to a corner (zero both handles). */
export function makeCorner(seg: paper.Segment): void {
  seg.handleIn = new paper.Point(0, 0);
  seg.handleOut = new paper.Point(0, 0);
}

/** Set handleOut = v and mirror handleIn = -v (a symmetric smooth point). */
export function setSymmetricHandles(seg: paper.Segment, handleOut: Vec): void {
  seg.handleOut = new paper.Point(handleOut.x, handleOut.y);
  seg.handleIn = new paper.Point(-handleOut.x, -handleOut.y);
}

/** Snap a vector's angle to the nearest multiple of stepDeg, preserving length. */
export function constrainAngle(v: Vec, stepDeg: number): Vec {
  const len = Math.hypot(v.x, v.y);
  if (len < EPS) return { x: 0, y: 0 };
  const angle = Math.atan2(v.y, v.x);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  return { x: Math.cos(snapped) * len, y: Math.sin(snapped) * len };
}
