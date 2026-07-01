import type { EditorDoc } from "./document";

/**
 * Snapshot-based undo/redo. Each `capture()` serializes the whole project to
 * JSON and pushes it on a stack; undo/redo restore adjacent snapshots by
 * clearing and re-importing. Simple and always-correct (at the cost of full
 * snapshots), which is the right trade for a v0.
 */
export class History {
  private doc: EditorDoc;
  private stack: string[] = [];
  private ptr = -1;
  private limit: number;

  constructor(doc: EditorDoc, limit = 100) {
    this.doc = doc;
    this.limit = limit;
    this.capture(); // initial state
  }

  private current(): string {
    return this.doc.project.exportJSON();
  }

  /** Push the current document state, unless it is identical to the top. */
  capture(): void {
    const json = this.current();
    if (this.ptr >= 0 && this.stack[this.ptr] === json) return;
    this.stack = this.stack.slice(0, this.ptr + 1);
    this.stack.push(json);
    if (this.stack.length > this.limit) this.stack.shift();
    this.ptr = this.stack.length - 1;
  }

  private restore(json: string): void {
    this.doc.project.clear();
    this.doc.project.importJSON(json);
    if (this.doc.project.layers.length === 0) {
      this.doc.scope.activate();
      new this.doc.scope.Layer();
    }
    this.doc.scope.view?.update?.();
  }

  canUndo(): boolean {
    return this.ptr > 0;
  }

  canRedo(): boolean {
    return this.ptr < this.stack.length - 1;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    this.ptr--;
    this.restore(this.stack[this.ptr]);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo()) return false;
    this.ptr++;
    this.restore(this.stack[this.ptr]);
    return true;
  }
}
