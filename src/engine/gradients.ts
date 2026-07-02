import type paper from "paper";

export interface GradientStop {
  color: string; // hex
  offset: number; // 0..1
}
export interface GradientDesc {
  type: "linear" | "radial";
  stops: GradientStop[];
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Apply a gradient fill to each item. Paper accepts this config object at runtime. */
export function applyGradient(items: paper.Item[], desc: GradientDesc): void {
  const gradientColor = (it: paper.Item) =>
    ({
      gradient: {
        stops: desc.stops.map((s) => [s.color, s.offset]),
        radial: desc.type === "radial",
      },
      origin: [desc.from.x, desc.from.y],
      destination: [desc.to.x, desc.to.y],
    }) as unknown as paper.Color;
  for (const it of items) {
    (it as paper.Path).fillColor = gradientColor(it);
  }
}

/** Read the gradient fill of an item, or null if it isn't a gradient. */
export function readGradient(item: paper.Item): GradientDesc | null {
  const fc = (item as unknown as { fillColor?: any }).fillColor;
  if (!fc || !fc.gradient) return null;
  return {
    type: fc.gradient.radial ? "radial" : "linear",
    stops: fc.gradient.stops.map((s: any) => ({
      color: s.color.toCSS(true),
      offset: s.offset,
    })),
    from: { x: fc.origin.x, y: fc.origin.y },
    to: { x: fc.destination.x, y: fc.destination.y },
  };
}

/** A white→black linear gradient spanning the item's bounds. */
export function defaultGradient(item: paper.Item): GradientDesc {
  const b = item.bounds;
  return {
    type: "linear",
    stops: [
      { color: "#ffffff", offset: 0 },
      { color: "#000000", offset: 1 },
    ],
    from: { x: b.left, y: b.center.y },
    to: { x: b.right, y: b.center.y },
  };
}
