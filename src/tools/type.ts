import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";

const DEFAULT_FONT_SIZE = 24;
const DEFAULT_FONT = "sans-serif";

/**
 * Type tool (T): click to place a `PointText` and type into it inline. Keeps a
 * reference to the text being edited; `keyInput` mutates its content. Headless
 * and unit-tested (Paper stores/serializes text content without a real font).
 */
export class TypeTool {
  private doc: EditorDoc;
  private editingText: paper.PointText | null = null;
  private caretIndex = 0;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  /** Insertion-point index within the editing text's content. */
  get caret(): number {
    return this.caretIndex;
  }

  setCaret(i: number): void {
    const len = this.editingText ? this.editingText.content.length : 0;
    this.caretIndex = Math.max(0, Math.min(i, len));
  }

  moveCaret(dir: -1 | 1): void {
    this.setCaret(this.caretIndex + dir);
  }

  /** Begin editing an existing PointText (e.g. from a double-click). */
  editItem(item: paper.PointText): void {
    this.doc.scope.activate();
    this.editingText = item;
    this.caretIndex = item.content.length;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  get editing(): paper.PointText | null {
    return this.editingText;
  }

  get isEditing(): boolean {
    return this.editingText !== null;
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    // Commit/clean up any current edit before starting another.
    this.finish();

    const hit = this.doc.project.hitTest(this.pt(p), {
      fill: true,
      tolerance: HIT_TOLERANCE,
    });
    if (hit && hit.item && hit.item.className === "PointText") {
      this.editingText = hit.item as paper.PointText;
      this.caretIndex = this.editingText.content.length; // caret at end
      return;
    }

    const t = new this.doc.scope.PointText({
      point: [p.x, p.y],
      content: "",
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT,
    });
    t.fillColor = new this.doc.scope.Color(0, 0, 0);
    this.editingText = t;
    this.caretIndex = 0;
  }

  keyInput(key: string): void {
    const t = this.editingText;
    if (!t) return;
    const c = this.caretIndex;
    if (key === "Backspace") {
      if (c > 0) {
        t.content = t.content.slice(0, c - 1) + t.content.slice(c);
        this.caretIndex = c - 1;
      }
    } else {
      const ch = key === "Enter" ? "\n" : key.length === 1 ? key : "";
      if (ch) {
        t.content = t.content.slice(0, c) + ch + t.content.slice(c);
        this.caretIndex = c + 1;
      }
    }
  }

  setContent(s: string): void {
    if (this.editingText) {
      this.editingText.content = s;
      this.setCaret(s.length);
    }
  }

  setFontSize(n: number): void {
    if (this.editingText) this.editingText.fontSize = n;
  }

  setFontFamily(f: string): void {
    if (this.editingText) this.editingText.fontFamily = f;
  }

  finish(): void {
    if (this.editingText && this.editingText.content.length === 0) {
      this.editingText.remove();
    }
    this.editingText = null;
    this.caretIndex = 0;
  }
}
