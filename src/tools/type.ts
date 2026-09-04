import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { hitTestItem } from "./hitTest";

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
  // DOM-style selection model: caret and anchor are always valid indices; a
  // selection exists exactly when they differ (collapsed = no selection).
  private caretIndex = 0;
  private anchorIndex = 0;

  constructor(doc: EditorDoc) {
    this.doc = doc;
  }

  /** Insertion-point index within the editing text's content. */
  get caret(): number {
    return this.caretIndex;
  }

  /** True when a non-empty text range is selected (as opposed to a bare caret). */
  get hasSelection(): boolean {
    return this.anchorIndex !== this.caretIndex;
  }

  /** Selected range, normalized so start <= end, or null when there's no selection. */
  get selectionRange(): { start: number; end: number } | null {
    if (!this.hasSelection) return null;
    return this.anchorIndex < this.caretIndex
      ? { start: this.anchorIndex, end: this.caretIndex }
      : { start: this.caretIndex, end: this.anchorIndex };
  }

  get selectedText(): string {
    const r = this.selectionRange;
    if (!r || !this.editingText) return "";
    return this.editingText.content.slice(r.start, r.end);
  }

  setCaret(i: number, extend = false): void {
    const len = this.editingText ? this.editingText.content.length : 0;
    this.caretIndex = Math.max(0, Math.min(i, len));
    if (!extend) this.anchorIndex = this.caretIndex;
  }

  moveCaret(dir: -1 | 1, extend = false): void {
    // A plain arrow with a selection collapses it to the corresponding edge
    // (like every text editor) instead of moving from the caret position.
    const r = this.selectionRange;
    if (!extend && r) {
      this.setCaret(dir < 0 ? r.start : r.end);
      return;
    }
    this.setCaret(this.caretIndex + dir, extend);
  }

  /** Select the entire content (used by Cmd/Ctrl-A while typing). */
  selectAll(): void {
    if (!this.editingText) return;
    this.anchorIndex = 0;
    this.caretIndex = this.editingText.content.length;
  }

  /** Remove the selected range (if any); caret ends up at the range start. */
  deleteSelection(): void {
    const r = this.selectionRange;
    const t = this.editingText;
    if (!r || !t) return;
    t.content = t.content.slice(0, r.start) + t.content.slice(r.end);
    this.setCaret(r.start);
  }

  /** Insert a string at the caret, replacing the selection first if present. */
  insertText(s: string): void {
    const t = this.editingText;
    if (!t || !s) return;
    if (this.hasSelection) this.deleteSelection();
    const c = this.caretIndex;
    t.content = t.content.slice(0, c) + s + t.content.slice(c);
    this.setCaret(c + s.length);
  }

  /** Begin editing an existing PointText (e.g. from a double-click). */
  editItem(item: paper.PointText): void {
    this.doc.scope.activate();
    this.editingText = item;
    this.setCaret(item.content.length);
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

    const hitItem = hitTestItem(this.doc, this.pt(p), HIT_TOLERANCE, { fill: true });
    if (hitItem && hitItem.className === "PointText") {
      this.editingText = hitItem as paper.PointText;
      this.setCaret(this.editingText.content.length); // caret at end
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
    this.setCaret(0);
  }

  keyInput(key: string): void {
    const t = this.editingText;
    if (!t) return;
    if (key === "Backspace") {
      if (this.hasSelection) {
        this.deleteSelection();
        return;
      }
      const c = this.caretIndex;
      if (c > 0) {
        t.content = t.content.slice(0, c - 1) + t.content.slice(c);
        this.setCaret(c - 1);
      }
      return;
    }
    const ch = key === "Enter" ? "\n" : key.length === 1 ? key : "";
    if (ch) this.insertText(ch);
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

  /** Commit the edit. Returns the kept text item, or null if it was empty/removed. */
  finish(): paper.PointText | null {
    const t = this.editingText;
    this.editingText = null;
    this.caretIndex = 0;
    this.anchorIndex = 0;
    if (t && t.content.length === 0) {
      t.remove();
      return null;
    }
    return t;
  }
}
