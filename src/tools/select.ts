import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";

/**
 * Selection tool (V): click to select the topmost item, shift to add/toggle,
 * empty click to clear, and drag a marquee to select intersecting items.
 * Selected items feed the Pathfinder. Headless and unit-tested.
 */
export class SelectTool {
  private doc: EditorDoc;
  private downPoint: Vec | null = null;
  private marquee: paper.Path | null = null;
  private dragging = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get selection(): paper.Item[] {
    return this.doc.project.selectedItems as paper.Item[];
  }

  clear(): void {
    this.doc.project.deselectAll();
  }

  selectAll(): void {
    this.doc.project.activeLayer.children.forEach((c) => (c.selected = true));
  }

  deleteSelection(): void {
    [...this.selection].forEach((it) => it.remove());
  }

  pointerDown(p: Vec, m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.downPoint = { x: p.x, y: p.y };
    this.dragging = false;
    const hit = this.doc.project.hitTest(this.pt(p), {
      fill: true,
      stroke: true,
      segments: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.item) {
      if (!m.shift) {
        this.clear();
        hit.item.selected = true;
      } else {
        hit.item.selected = !hit.item.selected;
      }
    } else if (!m.shift) {
      this.clear();
    }
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.downPoint) return;
    this.dragging = true;
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({
      from: this.pt(this.downPoint),
      to: this.pt(p),
    });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.strokeWidth = 1;
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.dragging && this.downPoint) {
      const rect = new this.doc.scope.Rectangle(
        this.pt(this.downPoint),
        this.pt(p)
      );
      const marquee = this.marquee;
      this.doc.project.activeLayer.children.forEach((child) => {
        if (child === marquee) return;
        if (child.bounds.intersects(rect)) child.selected = true;
      });
      if (this.marquee) {
        this.marquee.remove();
        this.marquee = null;
      }
    }
    this.downPoint = null;
    this.dragging = false;
  }
}
