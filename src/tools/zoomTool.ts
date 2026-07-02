import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { zoomAtPoint, fitBounds } from "@/engine/viewport";

/**
 * Zoom tool (Z): click zooms in 2× at the click, Alt-click zooms out 0.5×, and
 * a marquee drag zooms to fit that box. Thin wrapper over `viewport` math.
 */
export class ZoomTool {
  private doc: EditorDoc;
  private downPoint: Vec | null = null;
  private marquee: paper.Path | null = null;
  private dragging = false;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  get zoom(): number {
    return this.doc.scope.view.zoom;
  }

  private apply(next: { zoom: number; center: Vec }): void {
    const view = this.doc.scope.view;
    view.zoom = next.zoom;
    view.center = new this.doc.scope.Point(next.center.x, next.center.y);
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.downPoint = { x: p.x, y: p.y };
    this.dragging = false;
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.downPoint) return;
    this.dragging = true;
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({
      from: new this.doc.scope.Point(this.downPoint.x, this.downPoint.y),
      to: new this.doc.scope.Point(p.x, p.y),
    });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.strokeWidth = 1 / this.doc.scope.view.zoom;
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, m: Modifiers = {}): void {
    const view = this.doc.scope.view;
    const state = { zoom: view.zoom, center: { x: view.center.x, y: view.center.y } };
    if (this.dragging && this.downPoint) {
      const x = Math.min(this.downPoint.x, p.x);
      const y = Math.min(this.downPoint.y, p.y);
      const w = Math.abs(p.x - this.downPoint.x);
      const h = Math.abs(p.y - this.downPoint.y);
      if (this.marquee) {
        this.marquee.remove();
        this.marquee = null;
      }
      if (w > 2 && h > 2) {
        this.apply(
          fitBounds(
            { width: view.viewSize.width, height: view.viewSize.height },
            { x, y, width: w, height: h }
          )
        );
      }
    } else {
      this.apply(zoomAtPoint(state, m.alt ? 0.5 : 2, p));
    }
    this.downPoint = null;
    this.dragging = false;
  }
}
