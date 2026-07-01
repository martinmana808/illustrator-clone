import type paper from "paper";

type Styleable = paper.Item & {
  fillColor: paper.Color | null;
  strokeColor: paper.Color | null;
  strokeWidth: number;
};

function toHex(color: paper.Color | null): string | null {
  if (!color) return null;
  return color.toCSS(true); // "#rrggbb"
}

export function applyFill(items: paper.Item[], cssColor: string | null): void {
  for (const it of items) {
    (it as Styleable).fillColor = cssColor as unknown as paper.Color | null;
  }
}

export function applyStroke(items: paper.Item[], cssColor: string | null): void {
  for (const it of items) {
    (it as Styleable).strokeColor = cssColor as unknown as paper.Color | null;
  }
}

export function applyStrokeWidth(items: paper.Item[], width: number): void {
  for (const it of items) {
    (it as Styleable).strokeWidth = width;
  }
}

function common<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

export interface StyleSummary {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
}

/** Common style across items, or null per-field when they disagree/empty. */
export function readStyle(items: paper.Item[]): StyleSummary {
  const s = items as Styleable[];
  return {
    fill: common(s.map((it) => toHex(it.fillColor))),
    stroke: common(s.map((it) => toHex(it.strokeColor))),
    strokeWidth: common(s.map((it) => it.strokeWidth ?? null)),
  };
}
