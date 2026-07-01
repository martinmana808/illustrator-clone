import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import {
  hitTransform,
  pivotFor,
  axisFactors,
  type BoundsLike,
  type HandleName,
} from "./transformBox";
import { scaleItems, rotateItems, translateItems } from "@/engine/transform";

const ROT_ZONE = 22;

type Mode = "idle" | "move" | "scale" | "rotate" | "marquee";

/**
 * Selection tool (V): click/shift/marquee to select, drag to move, and use the
 * bounding-box handles to scale, or the corner rings to rotate. Selected items
 * feed the Pathfinder. Transform math lives in `transformBox`/`engine/transform`.
 */
export class SelectTool {
  private doc: EditorDoc;
  private downPoint: Vec | null = null;
  private last: Vec | null = null;
  private marquee: paper.Path | null = null;
  private mode: Mode = "idle";
  private handle: HandleName | null = null;
  private pivot = { x: 0, y: 0 };
  private center = { x: 0, y: 0 };

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get selection(): paper.Item[] {
    return this.doc.project.selectedItems as paper.Item[];
  }

  /** Combined bounds of the current selection, or null when empty. */
  selectionBounds(): BoundsLike | null {
    const items = this.selection;
    if (items.length === 0) return null;
    let b = items[0].bounds;
    for (let i = 1; i < items.length; i++) b = b.unite(items[i].bounds);
    return { x: b.x, y: b.y, width: b.width, height: b.height };
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
    this.last = { x: p.x, y: p.y };
    this.mode = "idle";
    this.handle = null;

    // 1) Transform handles / rotation ring (only when something is selected).
    const bounds = this.selectionBounds();
    if (bounds) {
      const ht = hitTransform(bounds, p.x, p.y, HIT_TOLERANCE, ROT_ZONE);
      if (ht?.kind === "scale") {
        this.mode = "scale";
        this.handle = ht.handle;
        this.pivot = pivotFor(ht.handle, bounds);
        return;
      }
      if (ht?.kind === "rotate") {
        this.mode = "rotate";
        this.center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        return;
      }
    }

    // 2) Hit an item → select and prepare to move.
    const hit = this.doc.project.hitTest(this.pt(p), {
      fill: true,
      stroke: true,
      segments: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.item) {
      if (!m.shift) {
        if (!hit.item.selected) this.clear();
        hit.item.selected = true;
      } else {
        hit.item.selected = !hit.item.selected;
      }
      this.mode = "move";
      return;
    }

    // 3) Empty space → clear + marquee.
    if (!m.shift) this.clear();
    this.mode = "marquee";
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.last) return;
    const items = this.selection;

    if (this.mode === "scale" && this.handle) {
      const { ax, ay } = axisFactors(this.handle);
      let sx = 1;
      let sy = 1;
      if (ax && Math.abs(this.last.x - this.pivot.x) > 1e-6) {
        sx = (p.x - this.pivot.x) / (this.last.x - this.pivot.x);
      }
      if (ay && Math.abs(this.last.y - this.pivot.y) > 1e-6) {
        sy = (p.y - this.pivot.y) / (this.last.y - this.pivot.y);
      }
      scaleItems(items, sx, sy, this.pivot.x, this.pivot.y);
      this.last = { x: p.x, y: p.y };
      return;
    }

    if (this.mode === "rotate") {
      const a1 = Math.atan2(this.last.y - this.center.y, this.last.x - this.center.x);
      const a2 = Math.atan2(p.y - this.center.y, p.x - this.center.x);
      const deg = ((a2 - a1) * 180) / Math.PI;
      rotateItems(items, deg, this.center.x, this.center.y);
      this.last = { x: p.x, y: p.y };
      return;
    }

    if (this.mode === "move") {
      translateItems(items, p.x - this.last.x, p.y - this.last.y);
      this.last = { x: p.x, y: p.y };
      return;
    }

    // marquee
    this.mode = "marquee";
    if (this.marquee) this.marquee.remove();
    this.marquee = new this.doc.scope.Path.Rectangle({
      from: this.pt(this.downPoint!),
      to: this.pt(p),
    });
    this.marquee.strokeColor = new this.doc.scope.Color(0.3, 0.5, 1);
    this.marquee.strokeWidth = 1;
    this.marquee.dashArray = [3, 3];
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.marquee && this.downPoint) {
      const rect = new this.doc.scope.Rectangle(this.pt(this.downPoint), this.pt(p));
      const marquee = this.marquee;
      this.doc.project.activeLayer.children.forEach((child) => {
        if (child === marquee) return;
        if (child.bounds.intersects(rect)) child.selected = true;
      });
      this.marquee.remove();
      this.marquee = null;
    }
    this.downPoint = null;
    this.last = null;
    this.mode = "idle";
    this.handle = null;
  }
}
