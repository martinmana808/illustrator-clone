# Shape Tools (Illustrator parity) — Design

**Date:** 2026-07-02
**Status:** Approved (YOLO autonomous build)

## Goal

The six core Illustrator shape tools — Rectangle, Rounded Rectangle, Ellipse, Polygon,
Star, Line — each drag-to-create, producing real editable paths, with drawing-time
modifiers (Shift constrain, Alt from-center, arrow keys for sides/points/radius).

## Geometry — `src/engine/shapes.ts` (pure, tested)

Thin wrappers over Paper's builders, returning a `paper.Path`:
- `buildRectangle(scope, x, y, w, h, radius=0)`
- `buildEllipse(scope, x, y, w, h)`
- `buildPolygon(scope, cx, cy, radius, sides)` — RegularPolygon
- `buildStar(scope, cx, cy, outerR, innerR, points)`
- `buildLine(scope, x1, y1, x2, y2)`

## ShapeTool — `src/tools/shapeTool.ts` (headless state machine)

One tool parameterized by `kind`. From drag start `S` to current `C`:
- **Rectangle / Rounded Rect / Ellipse**: bounding box `S..C`. Shift → square/circle
  (equal sides); Alt → centered on `S`. Rounded-rect corner radius default 12, arrow
  up/down ±2.
- **Line**: `S`→`C`; Shift constrains to 45° increments.
- **Polygon / Star**: center `S`, radius `|C-S|`, rotation from drag angle. Shift
  constrains rotation. Arrow up/down changes sides (polygon, default 6) / points (star,
  default 5); star inner radius = outer × 0.5.

Rebuilds the live shape each drag event; on up commits history. New shapes get a default
fill (`#c8c8cc`) + black stroke so they are visible.

API: `setKind(kind)`, `pointerDown/Drag/Up(p, m?)`, `keyInput(key)` (arrows), `get drawing()`.

## Wiring

- `ToolId` gains `rectangle`, `rounded-rectangle`, `ellipse`, `polygon`, `star`, `line`.
- Toolbar buttons for all six; shortcuts **M** (rectangle), **L** (ellipse), **\\** (line).
- `useActiveTool.ts`: one `ShapeTool`; when the active tool is a shape kind, route
  pointer events through it (`setKind` first), commit on up; forward arrow keys while
  drawing (via `ArtboardCanvas` keydown).

## Testing

- `shapes.ts`: each builder's bounds/segment-count/area (unit-tested).
- `ShapeTool`: rectangle/square/centered, ellipse, line, polygon side-count, star
  segment-count, arrow-adjust sides — all headless.
- Browser-verified: draw each shape, Shift/Alt modifiers, arrow-key sides.

## Non-goals (this phase)

Live post-creation editing (corner widgets, editable sides/points) → Phase 3 contextual
panel. Arc/Spiral/Grid tools, click-for-dialog exact dimensions.
