import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { constrainAngle } from "@/engine/anchors";
import { buildRectangle, buildEllipse, buildPolygon, buildStar, buildLine } from "@/engine/shapes";

export type ShapeKind =
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "polygon"
  | "star"
  | "line";

export const SHAPE_KINDS: ShapeKind[] = [
  "rectangle",
  "rounded-rectangle",
  "ellipse",
  "polygon",
  "star",
  "line",
];

/**
 * Drag-to-create shape tool, parameterized by `kind`. Rebuilds a live shape on
 * each drag; Shift constrains (square/circle/45°), Alt draws from center, and
 * arrow keys adjust polygon sides / star points / corner radius. Headless.
 */
export class ShapeTool {
  private doc: EditorDoc;
  private kind: ShapeKind = "rectangle";
  private start: Vec | null = null;
  private current: Vec | null = null;
  private lastMods: Modifiers = {};
  private path: paper.Path | null = null;
  private sides = 6;
  private points = 5;
  private cornerRadius = 12;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  get drawing(): boolean {
    return this.start !== null;
  }
  get currentPath(): paper.Path | null {
    return this.path;
  }

  setKind(k: ShapeKind): void {
    this.kind = k;
  }

  private style(p: paper.Path): void {
    p.fillColor = new this.doc.scope.Color(0.78, 0.78, 0.8);
    p.strokeColor = new this.doc.scope.Color(0, 0, 0);
    p.strokeWidth = 1;
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    this.start = { x: p.x, y: p.y };
    this.current = { x: p.x, y: p.y };
    this.path = null;
  }

  pointerDrag(p: Vec, m: Modifiers = {}): void {
    if (!this.start) return;
    this.current = { x: p.x, y: p.y };
    this.lastMods = m;
    this.rebuild();
  }

  pointerUp(p: Vec, m: Modifiers = {}): paper.Path | null {
    if (!this.start) return null;
    this.current = { x: p.x, y: p.y };
    this.lastMods = m;
    this.rebuild();
    const s = this.start;
    const c = this.current;
    if (Math.abs(c.x - s.x) < 1 && Math.abs(c.y - s.y) < 1 && this.path) {
      this.path.remove();
      this.path = null;
    }
    const result = this.path;
    this.start = null;
    this.current = null;
    this.path = null;
    return result;
  }

  keyInput(key: string): void {
    if (!this.start) return;
    if (this.kind === "polygon") {
      if (key === "ArrowUp") this.sides++;
      if (key === "ArrowDown") this.sides = Math.max(3, this.sides - 1);
    } else if (this.kind === "star") {
      if (key === "ArrowUp") this.points++;
      if (key === "ArrowDown") this.points = Math.max(3, this.points - 1);
    } else if (this.kind === "rounded-rectangle") {
      if (key === "ArrowUp") this.cornerRadius += 2;
      if (key === "ArrowDown") this.cornerRadius = Math.max(0, this.cornerRadius - 2);
    }
    this.rebuild();
  }

  private rebuild(): void {
    if (!this.start || !this.current) return;
    if (this.path) {
      this.path.remove();
      this.path = null;
    }
    const scope = this.doc.scope;
    const s = this.start;
    const c = this.current;
    const m = this.lastMods;
    let path: paper.Path;

    if (this.kind === "line") {
      let ex = c.x;
      let ey = c.y;
      if (m.shift) {
        const con = constrainAngle({ x: c.x - s.x, y: c.y - s.y }, 45);
        ex = s.x + con.x;
        ey = s.y + con.y;
      }
      path = buildLine(scope, s.x, s.y, ex, ey);
    } else if (this.kind === "polygon" || this.kind === "star") {
      const dx = c.x - s.x;
      const dy = c.y - s.y;
      const radius = Math.hypot(dx, dy) || 0.01;
      path =
        this.kind === "polygon"
          ? buildPolygon(scope, s.x, s.y, radius, this.sides)
          : buildStar(scope, s.x, s.y, radius, radius * 0.5, this.points);
      let rot = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (m.shift) rot = Math.round(rot / 45) * 45;
      path.rotate(rot, new scope.Point(s.x, s.y));
    } else {
      let dx = c.x - s.x;
      let dy = c.y - s.y;
      if (m.shift) {
        const mag = Math.max(Math.abs(dx), Math.abs(dy));
        dx = (Math.sign(dx) || 1) * mag;
        dy = (Math.sign(dy) || 1) * mag;
      }
      const radius = this.kind === "rounded-rectangle" ? this.cornerRadius : 0;
      let left: number;
      let top: number;
      let w: number;
      let h: number;
      if (m.alt) {
        left = s.x - Math.abs(dx);
        top = s.y - Math.abs(dy);
        w = Math.abs(dx) * 2;
        h = Math.abs(dy) * 2;
      } else {
        left = Math.min(s.x, s.x + dx);
        top = Math.min(s.y, s.y + dy);
        w = Math.abs(dx);
        h = Math.abs(dy);
      }
      path =
        this.kind === "ellipse"
          ? buildEllipse(scope, left, top, w || 0.01, h || 0.01)
          : buildRectangle(scope, left, top, w || 0.01, h || 0.01, radius);
    }

    this.style(path);
    this.path = path;
  }
}
