import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers, PenCursor } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { setSymmetricHandles, makeCorner, constrainAngle } from "@/engine/anchors";

/**
 * Full-parity Pen tool, modeled as a headless state machine. It translates
 * abstract pointer events into Paper.js path mutations and renders nothing
 * itself — the canvas layer reads `currentPath`, `previewPoint`, and
 * `hoverCursor` to draw overlays and pick cursors.
 */
export class PenTool {
  private doc: EditorDoc;
  private path: paper.Path | null = null;
  private preview: Vec | null = null;

  // Drag state for shaping the just-placed anchor into a smooth point.
  private dragAnchor: paper.Segment | null = null;
  private downPoint: Vec | null = null;

  // Alt-convert state.
  private convertSeg: paper.Segment | null = null;
  private convertDidDrag = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  get currentPath(): paper.Path | null {
    return this.path;
  }

  get previewPoint(): Vec | null {
    return this.preview;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  private hitTest(p: Vec): paper.HitResult | null {
    return this.doc.project.hitTest(this.pt(p), {
      segments: true,
      stroke: true,
      handles: true,
      tolerance: HIT_TOLERANCE,
    });
  }

  private nearFirstAnchor(p: Vec): boolean {
    if (!this.path || this.path.segments.length < 2) return false;
    return this.path.segments[0].point.getDistance(this.pt(p)) <= HIT_TOLERANCE;
  }

  private startPath(): paper.Path {
    const path = new this.doc.scope.Path();
    path.strokeColor = new this.doc.scope.Color(0, 0, 0);
    path.strokeWidth = 1;
    return path;
  }

  pointerDown(p: Vec, m: Modifiers = {}): void {
    this.doc.scope.activate();

    // --- Currently drawing a path ---
    if (this.path) {
      if (this.nearFirstAnchor(p)) {
        this.path.closed = true;
        this.dragAnchor = this.path.firstSegment;
        this.downPoint = { x: p.x, y: p.y };
        return;
      }
      this.dragAnchor = this.path.add(this.pt(p)) as paper.Segment;
      this.downPoint = { x: p.x, y: p.y };
      return;
    }

    // --- Not drawing: inspect existing geometry ---
    const hit = this.hitTest(p);

    // Alt: convert anchor (corner<->smooth / break symmetry).
    if (m.alt && hit && hit.segment) {
      this.convertSeg = hit.segment;
      this.convertDidDrag = false;
      this.downPoint = { x: p.x, y: p.y };
      return;
    }

    if (hit && hit.type === "segment" && hit.segment && hit.item) {
      const hitPath = hit.item as paper.Path;
      const seg = hit.segment;
      // Continue an open path from either endpoint.
      const isEndpoint =
        !hitPath.closed &&
        (seg.index === 0 || seg.index === hitPath.segments.length - 1);
      if (isEndpoint) {
        this.path = hitPath;
        if (seg.index === 0) hitPath.reverse(); // append at the clicked end
        return;
      }
      // Otherwise delete the anchor.
      seg.remove();
      return;
    }

    // Add an anchor on a stroke, preserving the curve shape.
    if (hit && hit.type === "stroke" && hit.location) {
      hit.location.curve.divideAtTime(hit.location.time);
      return;
    }

    // Empty space: begin a new path with a corner anchor.
    this.path = this.startPath();
    this.dragAnchor = this.path.add(this.pt(p)) as paper.Segment;
    this.downPoint = { x: p.x, y: p.y };
  }

  pointerDrag(p: Vec, m: Modifiers = {}): void {
    // Alt-convert drag: pull out symmetric handles.
    if (this.convertSeg && this.downPoint) {
      this.convertDidDrag = true;
      let dx = p.x - this.downPoint.x;
      let dy = p.y - this.downPoint.y;
      if (m.shift) {
        const c = constrainAngle({ x: dx, y: dy }, 45);
        dx = c.x;
        dy = c.y;
      }
      setSymmetricHandles(this.convertSeg, { x: dx, y: dy });
      return;
    }

    // Shaping the just-placed anchor into a smooth point.
    if (this.dragAnchor && this.downPoint) {
      let dx = p.x - this.downPoint.x;
      let dy = p.y - this.downPoint.y;
      if (m.shift) {
        const c = constrainAngle({ x: dx, y: dy }, 45);
        dx = c.x;
        dy = c.y;
      }
      setSymmetricHandles(this.dragAnchor, { x: dx, y: dy });
    }
  }

  pointerUp(_p: Vec, _m: Modifiers = {}): void {
    if (this.convertSeg) {
      if (!this.convertDidDrag) makeCorner(this.convertSeg);
      this.convertSeg = null;
      this.downPoint = null;
      return;
    }
    this.dragAnchor = null;
    this.downPoint = null;
  }

  pointerMove(p: Vec, _m: Modifiers = {}): void {
    this.preview = this.path ? { x: p.x, y: p.y } : null;
  }

  finish(): void {
    this.path = null;
    this.preview = null;
    this.dragAnchor = null;
    this.downPoint = null;
  }

  hoverCursor(p: Vec, m: Modifiers = {}): PenCursor {
    if (this.nearFirstAnchor(p)) return "close";
    if (this.path) return "pen";
    const hit = this.hitTest(p);
    if (m.alt && hit && hit.segment) return "corner";
    if (hit && hit.type === "segment" && hit.item) {
      const hitPath = hit.item as paper.Path;
      const seg = hit.segment;
      const isEndpoint =
        !hitPath.closed &&
        (seg.index === 0 || seg.index === hitPath.segments.length - 1);
      return isEndpoint ? "continue" : "delete";
    }
    if (hit && hit.type === "stroke") return "add";
    return "pen";
  }
}
