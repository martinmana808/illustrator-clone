# Zoom & Pan (Illustrator parity) — Design

**Date:** 2026-07-02
**Status:** Approved

## Goal

Full Illustrator-style navigation: zoom and pan a full-viewport document window,
via the Zoom tool, Hand tool / spacebar, keyboard shortcuts, and trackpad/scroll,
with a live zoom-% status bar. All existing tools keep working unchanged because
navigation only moves Paper's `view.zoom`/`view.center` (tools use document coords).

## Viewport model

- The `<canvas>` fills the middle panel and resizes with the window
  (`view.viewSize` tracks the element size).
- A **full-screen artboard**: a white rectangle sized to the stage's client size at
  first mount (so 100% fills the screen), fixed thereafter. Drawn inside the canvas
  as document **chrome** (a Paper item tagged `data.isChrome = true`) with a subtle
  border/shadow, always at the back.
- Chrome (artboard rect) is stripped before every history capture and SVG/PNG export,
  then redrawn — it never appears in saved artwork. (Same mechanism as UI overlays.)

## Navigation math — `src/engine/viewport.ts` (pure, unit-tested)

- `clampZoom(z)`: constrain to `[0.03, 64]` (3%–6400%).
- `zoomAtPoint({ zoom, center }, factor, pivot)` → `{ zoom, center }`: new zoom is
  `clampZoom(zoom*factor)`; new center keeps `pivot` (document coords) fixed on screen:
  `center' = pivot + (center - pivot) * (zoom / zoom')`.
- `fitBounds(viewSize, bounds, padding=0.04)` → `{ zoom, center }`: `zoom =
  clampZoom(min(viewSize.w/bounds.w, viewSize.h/bounds.h) * (1 - padding))`,
  `center = bounds center`.

## Tools & inputs

- **Zoom tool (`zoom`, Z)**: click → zoom 2× at click; Alt-click → 0.5×; marquee drag →
  `fitBounds(marquee)`. Toolbar button + Z.
- **Hand tool (`hand`, H)** and **hold-Space**: drag pans (`view.center -= dragDelta`).
- **Keyboard**: ⌘/Ctrl+`=`/`+` zoom in, ⌘/Ctrl+`-` zoom out (at viewport center), ⌘0 fit
  artboard, ⌘1 actual size (zoom = 1, center = artboard center).
- **Wheel/trackpad**: `ctrlKey`/`metaKey` + wheel (pinch reports ctrlKey) → zoom at cursor;
  plain wheel → pan (deltaX/deltaY); Shift+wheel → horizontal pan.

## Zoom % UI — `src/components/ZoomStatusBar.tsx`

Bottom-left status bar: live zoom % (from store) + a `<select>` of presets
(Fit, 25, 50, 100, 200, 400, 800 %). `zoom` is added to the store and updated after
every navigation so the readout stays in sync.

## Export interaction

- **SVG**: unaffected (document-space geometry); strip chrome + overlays (existing).
- **PNG**: render the **artboard region at 100%** regardless of current zoom — temporarily
  set `view.zoom = 1` / `view.center = artboardCenter` / `viewSize = artboardSize`, draw,
  `toDataURL`, then restore. So the PNG is always the clean artboard.

## Controller additions (`ToolController`)

`zoomIn()`, `zoomOut()`, `zoomTo(z)`, `fitArtboard()`, `actualSize()`,
`zoomAtClient(clientX, clientY, factor)`, `panBy(dx, dy)`, `getZoom()`.
Each updates `view` then writes `zoom` to the store.

## Files

- New: `src/engine/viewport.ts` (+test), `src/tools/zoomTool.ts`, `src/tools/handTool.ts`,
  `src/components/ZoomStatusBar.tsx`.
- Modified: `ArtboardCanvas.tsx` (fill/resize, wheel/space/keyboard), `useActiveTool.ts`
  (artboard chrome, nav methods, route Zoom/Hand, space-pan), `store.ts` + `Toolbar.tsx`
  (`zoom`/`hand` tools + `zoom` number), `EditorShell.tsx` + `globals.css` (status bar),
  `engine/export.ts` (PNG artboard region).

## Testing

- `viewport.ts`: pivot stays fixed under `zoomAtPoint`; `clampZoom` limits; `fitBounds`
  computes expected zoom + center. Unit-tested.
- Zoom/Hand tools are thin wrappers over the pure math.
- All inputs + status bar verified in-browser with screenshots.

## Non-goals

Multiple artboards, rotate view, zoom animation/easing, pixel-grid snapping.
