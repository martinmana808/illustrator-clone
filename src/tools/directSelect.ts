import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { isSmooth } from "@/engine/anchors";

type DragKind = "point" | "handleIn" | "handleOut" | null;

/**
 * Direct Selection tool (A): select and drag individual anchors and bezier
 * handles of existing paths. Smooth points mirror their opposite handle while
 * dragging; Alt breaks the pair. Headless and unit-tested.
 */
export class DirectSelectTool {
  private doc: EditorDoc;
  private dragSeg: paper.Segment | null = null;
  private dragKind: DragKind = null;
  private wasSmooth = false;
  private marquee: paper.Path | null = null;
  private downPoint: Vec | null = null;
  private dragging = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get selectedSegments(): paper.Segment[] {
    const out: paper.Segment[] = [];
    for (const layer of this.doc.project.layers) {
      for (const item of layer.children) {
        const path = item as paper.Path;
        if (!path.segments) continue;
        for (const seg of path.segments) if (seg.selected) out.push(seg);
      }
    }
    return out;
  }

  private clearSegments(): void {
    for (const seg of this.selectedSegments) seg.selected = false;
  }

  pointerDown(p: Vec, m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.downPoint = { x: p.x, y: p.y };
    this.dragging = false;
    this.dragSeg = null;
    this.dragKind = null;

    const hit = this.doc.project.hitTest(this.pt(p), {
      segments: true,
      handles: true,
      stroke: true,
      tolerance: HIT_TOLERANCE,
    });

    if (
      hit &&
      hit.segment &&
      (hit.type === "segment" || hit.type === "handle-in" || hit.type === "handle-out")
    ) {
      if (!m.shift) this.clearSegments();
      hit.segment.selected = true;
      this.dragSeg = hit.segment;
      this.wasSmooth = isSmooth(hit.segment);
      this.dragKind =
        hit.type === "handle-in"
          ? "handleIn"
          : hit.type === "handle-out"
            ? "handleOut"
            : "point";
      return;
    }

    if (hit && hit.type === "stroke" && hit.item) {
      if (!m.shift) this.clearSegments();
      (hit.item as paper.Path).fullySelected = true;
      return;
    }

    if (!m.shift) this.clearSegments();
  }

  pointerDrag(p: Vec, m: Modifiers = {}): void {
    if (this.dragSeg && this.dragKind) {
      const seg = this.dragSeg;
      if (this.dragKind === "point") {
        seg.point = this.pt(p);
      } else if (this.dragKind === "handleOut") {
        const h = this.pt(p).subtract(seg.point);
        seg.handleOut = h;
        if (this.wasSmooth && !m.alt) seg.handleIn = h.multiply(-1);
      } else if (this.dragKind === "handleIn") {
        const h = this.pt(p).subtract(seg.point);
        seg.handleIn = h;
        if (this.wasSmooth && !m.alt) seg.handleOut = h.multiply(-1);
      }
      return;
    }
    if (!this.downPoint) return;
    this.dragging = true;
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({
      from: this.pt(this.downPoint),
      to: this.pt(p),
    });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.dragging && this.downPoint && !this.dragSeg) {
      const rect = new this.doc.scope.Rectangle(
        this.pt(this.downPoint),
        this.pt(p)
      );
      const marquee = this.marquee;
      for (const layer of this.doc.project.layers) {
        for (const item of layer.children) {
          if (item === marquee) continue;
          const path = item as paper.Path;
          if (!path.segments) continue;
          for (const seg of path.segments) {
            if (rect.contains(seg.point)) seg.selected = true;
          }
        }
      }
    }
    if (this.marquee) {
      this.marquee.remove();
      this.marquee = null;
    }
    this.dragSeg = null;
    this.dragKind = null;
    this.downPoint = null;
    this.dragging = false;
  }
}
