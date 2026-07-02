# Pen & Anchor-Editing Illustrator Parity — Design

**Date:** 2026-07-01
**Status:** Approved

## Goal

Bring the Pen and anchor-editing experience to Illustrator fidelity: visible anchor
squares + direction handles, a dedicated Anchor Point (convert) tool, double-click
into point-editing, a real curved rubber-band preview, and context-sensitive
Illustrator-style Pen cursors.

## Behaviors

### Anchor Point tool (`anchor-point`, shortcut Shift+C)
Headless state machine; toolbar button + shortcut. Exact Illustrator behavior:
- **Drag a corner anchor** → pulls out symmetric direction handles (corner → smooth).
- **Click a smooth anchor** (no drag) → collapse to corner (remove handles).
- **Drag one handle** → move only that handle, breaking symmetry (independent handles).

Reuses `src/engine/anchors.ts` (`setSymmetricHandles`, `makeCorner`, `isSmooth`).
The same convert behavior remains available in the Pen via Alt.

### Anchor & handle rendering (Illustrator defaults)
- Disable Paper's default selection drawing via `scope.settings.handleSize = 0`.
- Custom overlay (in the existing overlay system, so stripped from saves/exports):
  - Each anchor of a selected path → small **square**: hollow when unselected,
    filled blue when selected.
  - **Selected** anchors → two **direction lines** with round **handle dots** at the ends.
  - Shown for the **direct-select** and **anchor-point** tools.
- Clicking an anchor selects it (reveals its handles). Clicking the path stroke selects
  the whole path (`fullySelected`). Handles are draggable via Direct Select (existing).

### Double-click a path → Direct Select
A `dblclick` listener on the canvas: when the Selection tool is active and the
double-click hits a path, switch to `direct-select` and select that path's anchors.

### Curved rubber-band preview
The Pen preview is a bezier from the last anchor into the cursor, using the last
anchor's outgoing handle (`handleOut`) — the actual curve about to be committed.
Dashed. Rendered in the overlay system.

### Illustrator-style Pen cursor
Custom SVG nib cursors, hotspot at the nib tip, swapped by `PenTool.hoverCursor()`:
- base nib · nib ✳ (start) · nib + (add anchor) · nib − (delete) · nib ○ (close) ·
  convert ^ (over anchor with Alt, and the Anchor Point tool).
Computed on every mouse-move; set via `canvas.style.cursor`.

## Architecture

- New `src/tools/anchorPoint.ts` — `AnchorPointTool` state machine.
- New `src/tools/penCursors.ts` — pure map `PenCursor → { url, hotspot }` (data-URI SVGs).
- `useActiveTool.ts` — route the anchor-point tool; render the anchor/handle overlay
  and curved preview; set the canvas cursor from hover state; `dblclick` → Direct Select.
- `pen.ts` — hover-cursor states already exist; ensure completeness.
- `store.ts` + `Toolbar.tsx` — add the `anchor-point` tool.
- `ArtboardCanvas.tsx` — Shift+C shortcut; drive cursor updates.

## Testing

- `AnchorPointTool`: headless tests — drag corner → symmetric handles; click smooth →
  corner (handles zeroed); drag handle → independent (only that handle changes).
- `penCursors`: pure map returns a url+hotspot for every `PenCursor` state.
- Curved preview, overlay rendering, double-click, cursor visuals: browser-verified
  with screenshots.

## Non-goals (this pass)

Spacebar-reposition-while-drawing, smart guides/snapping, multi-path handle editing
niceties beyond Illustrator defaults, gradients.
