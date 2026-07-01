import type paper from "paper";

export interface Glyph {
  char: string;
  x: number;
  y: number;
  rotation: number; // degrees
}

/** Measure a character's advance width in the given font. */
export type MeasureFn = (ch: string, fontSize: number, fontFamily: string) => number;

/**
 * Lay out `text` along `path`: each glyph is placed at its cumulative arc-length
 * offset and rotated to the path's tangent there. Pure — the caller supplies a
 * width-measuring function, so it's testable without real font metrics.
 */
export function layoutTextOnPath(
  path: paper.Path,
  text: string,
  measure: MeasureFn,
  fontSize = 24,
  fontFamily = "sans-serif"
): Glyph[] {
  const glyphs: Glyph[] = [];
  const len = path.length;
  let offset = 0;
  for (const ch of text) {
    if (offset > len) break;
    const at = Math.min(offset, len);
    const pt = path.getPointAt(at);
    const tan = path.getTangentAt(at);
    if (pt) {
      glyphs.push({
        char: ch,
        x: pt.x,
        y: pt.y,
        rotation: tan ? tan.angle : 0,
      });
    }
    offset += measure(ch, fontSize, fontFamily);
  }
  return glyphs;
}
