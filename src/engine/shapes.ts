import type paper from "paper";

type Scope = paper.PaperScope;

export function buildRectangle(
  scope: Scope,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0
): paper.Path {
  if (radius > 0) {
    return new scope.Path.Rectangle({
      point: [x, y],
      size: [w, h],
      radius,
    }) as paper.Path;
  }
  return new scope.Path.Rectangle({ point: [x, y], size: [w, h] }) as paper.Path;
}

export function buildEllipse(
  scope: Scope,
  x: number,
  y: number,
  w: number,
  h: number
): paper.Path {
  return new scope.Path.Ellipse({ point: [x, y], size: [w, h] }) as paper.Path;
}

export function buildPolygon(
  scope: Scope,
  cx: number,
  cy: number,
  radius: number,
  sides: number
): paper.Path {
  return new scope.Path.RegularPolygon(
    new scope.Point(cx, cy),
    Math.max(3, Math.round(sides)),
    Math.max(0.01, radius)
  ) as paper.Path;
}

export function buildStar(
  scope: Scope,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number
): paper.Path {
  return new scope.Path.Star(
    new scope.Point(cx, cy),
    Math.max(3, Math.round(points)),
    Math.max(0.01, outerR),
    Math.max(0.01, innerR)
  ) as paper.Path;
}

export function buildLine(
  scope: Scope,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): paper.Path {
  return new scope.Path.Line(new scope.Point(x1, y1), new scope.Point(x2, y2)) as paper.Path;
}
