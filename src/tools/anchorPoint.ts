import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { setSymmetricHandles, makeCorner } from "@/engine/anchors";

type Kind = "anchor" | "handleIn" | "handleOut" | null;

/**
 * Anchor Point (convert) tool — Illustrator's Shift+C. Drag a corner anchor to
 * pull out symmetric handles; click a smooth anchor to collapse it to a corner
 * (remove handles); drag one handle to break symmetry (independent handles).
 * Headless and unit-tested.
 */
export class AnchorPointTool {
  private doc: EditorDoc;
  private seg: paper.Segment | null = null;
  private kind: Kind = null;
  private downPoint: Vec | null = null;
  private didDrag = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.seg = null;
    this.kind = null;
    this.didDrag = false;
    this.downPoint = { x: p.x, y: p.y };
    const hit = this.doc.project.hitTest(this.pt(p), {
      segments: true,
      handles: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.segment) {
      this.seg = hit.segment;
      this.kind =
        hit.type === "handle-in"
          ? "handleIn"
          : hit.type === "handle-out"
            ? "handleOut"
            : "anchor";
    }
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.seg || !this.downPoint) return;
    this.didDrag = true;
    const seg = this.seg;
    if (this.kind === "anchor") {
      setSymmetricHandles(seg, { x: p.x - this.downPoint.x, y: p.y - this.downPoint.y });
    } else if (this.kind === "handleOut") {
      seg.handleOut = this.pt(p).subtract(seg.point);
    } else if (this.kind === "handleIn") {
      seg.handleIn = this.pt(p).subtract(seg.point);
    }
  }

  pointerUp(_p: Vec, _m: Modifiers = {}): void {
    if (this.seg && this.kind === "anchor" && !this.didDrag) {
      makeCorner(this.seg); // click a smooth point → collapse to corner
    }
    this.seg = null;
    this.kind = null;
    this.downPoint = null;
    this.didDrag = false;
  }
}
