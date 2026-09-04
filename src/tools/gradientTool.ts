import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { hitTestItem } from "./hitTest";
import { applyGradient, readGradient, defaultGradient, type GradientDesc } from "@/engine/gradients";

/**
 * Gradient tool (G): drag across a shape to set the gradient's direction and
 * extent. Uses the current gradient if the shape already has one, else a
 * default white→black. Headless.
 */
export class GradientTool {
  private doc: EditorDoc;
  private target: paper.Item | null = null;
  private desc: GradientDesc | null = null;
  private start: Vec | null = null;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get currentTarget(): paper.Item | null {
    return this.target;
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    let target = this.doc.project.selectedItems[0] as paper.Item | undefined;
    if (!target) {
      target = hitTestItem(this.doc, this.pt(p), HIT_TOLERANCE) ?? undefined;
    }
    if (!target) return;
    this.target = target;
    this.start = { x: p.x, y: p.y };
    const base = readGradient(target) ?? defaultGradient(target);
    this.desc = { ...base, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y } };
    applyGradient([target], this.desc);
  }

  pointerDrag(p: Vec, _m: Modifiers = {}): void {
    if (!this.target || !this.desc || !this.start) return;
    this.desc = { ...this.desc, from: this.start, to: { x: p.x, y: p.y } };
    applyGradient([this.target], this.desc);
  }

  pointerUp(p: Vec, _m: Modifiers = {}): void {
    if (this.target && this.desc && this.start) {
      this.desc = { ...this.desc, from: this.start, to: { x: p.x, y: p.y } };
      applyGradient([this.target], this.desc);
    }
    this.start = null;
  }
}
