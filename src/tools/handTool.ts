import type { EditorDoc } from "@/engine/document";
import type { Vec } from "./types";

/** Hand tool (H) / spacebar-pan: drag moves the view center opposite the drag. */
export class HandTool {
  private doc: EditorDoc;
  private last: Vec | null = null;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  pointerDown(p: Vec): void {
    this.last = { x: p.x, y: p.y };
  }

  pointerDrag(p: Vec): void {
    if (!this.last) return;
    const view = this.doc.scope.view;
    const dx = p.x - this.last.x;
    const dy = p.y - this.last.y;
    view.center = view.center.subtract(new this.doc.scope.Point(dx, dy));
  }

  pointerUp(_p: Vec): void {
    this.last = null;
  }
}
