import type { PenCursor } from "./types";

export interface CursorSpec {
  url: string;
  hotspot: [number, number];
}

// A pen-nib SVG with its tip at (2,2); an optional modifier glyph at top-right.
function nib(modifier: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<path d="M2 2 L11 5 L5 11 Z" fill="#000" stroke="#fff" stroke-width="1"/>
<path d="M6 10 L13 17" stroke="#000" stroke-width="1.5"/>
${modifier}
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const GLYPH = {
  none: "",
  star: `<path d="M18 3 v6 M15 6 h6 M16 4 l4 4 M20 4 l-4 4" stroke="#000" stroke-width="1"/>`,
  plus: `<path d="M15 5 h6 M18 2 v6" stroke="#000" stroke-width="1.5"/>`,
  minus: `<path d="M15 5 h6" stroke="#000" stroke-width="1.5"/>`,
  circle: `<circle cx="18" cy="5" r="3" fill="none" stroke="#000" stroke-width="1.5"/>`,
  caret: `<path d="M15 8 l3 -5 l3 5" fill="none" stroke="#000" stroke-width="1.5"/>`,
};

export const PEN_CURSORS: Record<PenCursor, CursorSpec> = {
  pen: { url: nib(GLYPH.none), hotspot: [2, 2] },
  continue: { url: nib(GLYPH.star), hotspot: [2, 2] },
  add: { url: nib(GLYPH.plus), hotspot: [2, 2] },
  delete: { url: nib(GLYPH.minus), hotspot: [2, 2] },
  close: { url: nib(GLYPH.circle), hotspot: [2, 2] },
  corner: { url: nib(GLYPH.caret), hotspot: [2, 2] },
};

/** CSS `cursor` value with the nib image, hotspot, and a crosshair fallback. */
export function cursorCss(c: PenCursor): string {
  const spec = PEN_CURSORS[c] ?? PEN_CURSORS.pen;
  return `url("${spec.url}") ${spec.hotspot[0]} ${spec.hotspot[1]}, crosshair`;
}
