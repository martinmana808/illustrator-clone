import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import type { Vec, Modifiers } from "./types";
import { HIT_TOLERANCE } from "./constants";
import { layoutTextOnPath, type MeasureFn } from "@/engine/textOnPath";

const DEFAULT_FONT_SIZE = 24;
const DEFAULT_FONT = "sans-serif";

function defaultMeasure(doc: EditorDoc): MeasureFn {
  return (ch, fontSize, fontFamily) => {
    const el = doc.scope.view?.element as HTMLCanvasElement | undefined;
    const ctx = el?.getContext?.("2d");
    if (!ctx) return fontSize * 0.5;
    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(ch).width;
  };
}

/**
 * Type-on-a-path tool: click a path to attach text that flows along it. Each
 * keystroke re-lays the glyphs (via `layoutTextOnPath`) as rotated PointTexts
 * in a group. The measure function is injectable so the tool is testable
 * headlessly (tests pass a fixed-width stub instead of real font metrics).
 */
export class TypeOnPathTool {
  private doc: EditorDoc;
  private measure: MeasureFn;
  private targetPath: paper.Path | null = null;
  private group: paper.Group | null = null;
  private textStr = "";
  private savedStroke: paper.Color | null = null;
  private fontSize = DEFAULT_FONT_SIZE;
  private fontFamily = DEFAULT_FONT;

  constructor(doc: EditorDoc, measure?: MeasureFn) {
    this.doc = doc;
    this.measure = measure ?? defaultMeasure(doc);
  }

  get text(): string {
    return this.textStr;
  }
  get isEditing(): boolean {
    return this.targetPath !== null;
  }
  get glyphGroup(): paper.Group | null {
    return this.group;
  }

  private pt(p: Vec): paper.Point {
    return new this.doc.scope.Point(p.x, p.y);
  }

  pointerDown(p: Vec, _m: Modifiers = {}): void {
    this.doc.scope.activate();
    const hit = this.doc.project.hitTest(this.pt(p), {
      stroke: true,
      tolerance: HIT_TOLERANCE,
      match: (r: paper.HitResult) => !!r.item && r.item.className === "Path",
    });
    if (hit && hit.item) {
      this.attach(hit.item as paper.Path);
    }
  }

  private attach(path: paper.Path): void {
    this.finish();
    this.targetPath = path;
    this.textStr = "";
    this.savedStroke = path.strokeColor;
    path.strokeColor = null; // the path becomes an invisible baseline
    this.group = new this.doc.scope.Group();
    this.relayout();
  }

  keyInput(key: string): void {
    if (!this.targetPath) return;
    if (key === "Backspace") this.textStr = this.textStr.slice(0, -1);
    else if (key.length === 1) this.textStr += key;
    this.relayout();
  }

  private relayout(): void {
    if (!this.group || !this.targetPath) return;
    this.group.removeChildren();
    const glyphs = layoutTextOnPath(
      this.targetPath,
      this.textStr,
      this.measure,
      this.fontSize,
      this.fontFamily
    );
    for (const g of glyphs) {
      const t = new this.doc.scope.PointText({
        point: [g.x, g.y],
        content: g.char,
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
      });
      t.fillColor = new this.doc.scope.Color(0, 0, 0);
      t.rotate(g.rotation, new this.doc.scope.Point(g.x, g.y));
      this.group.addChild(t);
    }
  }

  finish(): void {
    if (this.targetPath && this.textStr.length === 0) {
      // Nothing typed → restore the path and drop the empty group.
      this.targetPath.strokeColor = this.savedStroke;
      if (this.group) this.group.remove();
    }
    this.targetPath = null;
    this.group = null;
    this.textStr = "";
    this.savedStroke = null;
  }
}
