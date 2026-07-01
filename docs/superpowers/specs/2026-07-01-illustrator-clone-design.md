# Illustrator Clone — v0 Design

**Date:** 2026-07-01
**Status:** Approved
**Scope:** A focused, browser-based vector editor. The two marquee features are a **full-parity Pen tool** and a **full Pathfinder** (all 10 operations). Everything else exists only to make those two usable.

## Goal & Non-Goals

**Goal:** Prove that Pen + Pathfinder can reach genuine Adobe Illustrator parity in a web app, with just enough supporting UI (selection, fill/stroke, layers, export) to be usable.

**Non-Goals (v0):** Type tool, gradients, brushes, effects, symbols, artboards (multiple), image import, save/reopen native project format, undo history beyond a basic stack, mobile/touch optimization. These are deliberately out.

## Architecture

```
┌─────────────────────────────────────────────┐
│  React shell (toolbar, panels, color pickers) │  ← Zustand UI state
├─────────────────────────────────────────────┤
│  Tool layer (Pen, Direct-Select, Select …)   │  ← state machines, no rendering
├─────────────────────────────────────────────┤
│  Paper.js scene (Project → Layers → Paths)    │  ← geometry source of truth
└─────────────────────────────────────────────┘
```

- **Next.js + React** — app shell, panels, toolbar; deployable to Vercel.
- **Paper.js** — artboard engine: owns the canvas, path/segment model, hit-testing, boolean ops, SVG serialization.
- **Zustand** — UI-facing state (current tool, selection summary, fill/stroke values, layer list). Paper.js remains the source of truth for geometry; the store mirrors what panels need.
- **Vitest** — unit tests for geometry-heavy logic (Pen state machine, Pathfinder ops).

**Key principle:** Tools are plain state machines that translate pointer events into Paper.js mutations. They render nothing themselves. This isolation makes the Pen tool and Pathfinder ops testable headlessly, without a browser.

## Data Model

We lean on Paper.js's native model rather than inventing our own:

- **Document** → `paper.Project`
- **Layer** → `paper.Layer` (name, visibility, lock, z-order → drives the Layers panel)
- **Path** → `paper.Path` with `fillColor`, `strokeColor`, `strokeWidth`
- **Anchor point** → `paper.Segment` = `{ point, handleIn, handleOut }` — exactly Illustrator's anchor-plus-two-handles model
  - Corner point = zero-length handles
  - Smooth point = mirrored handles
  - Convert = manipulate those handles; no custom types needed

**Persistence (v0):** in-memory only. Output via **Export** — SVG (native from Paper.js) and PNG (raster at chosen scale). No save/reopen project format.

## Feature Spec — Pen Tool (Full Parity)

### Placing / drawing
- Click → corner anchor. Click-drag → smooth anchor with symmetric handles dragged live.
- **Rubber-band preview**: live curve segment from the last anchor to the cursor before the next click (Illustrator CC behavior).
- **Close path**: hovering the first anchor shows the ○ close indicator; click closes.
- **Continue an open path**: clicking the Pen on an endpoint of an existing open path resumes drawing.
- **Constrain**: `Shift` constrains handle/segment angles to 45° increments.

### Editing (contextual Pen cursors)
- **Add anchor**: Pen over a segment → `+` cursor → click inserts an anchor at the correct parametric `t`, preserving shape.
- **Delete anchor**: Pen over an existing anchor → `−` cursor → click removes it; curve re-fits.
- **Convert anchor** (`Alt`/Option = Anchor Point tool): drag a corner to pull out symmetric handles; click a smooth point to collapse to corner; `Alt`-drag one handle to break symmetry (independent handles).

### Selecting / adjusting
- **Direct Selection tool (A)** — required for parity: select individual anchors/handles, move them, drag handles, marquee-select anchors. Dragging one handle of a smooth point moves both; `Alt` breaks the pair.
- **Selection tool (V)** — select whole paths, move, delete, box-select multiple (also feeds Pathfinder).

## Feature Spec — Pathfinder (Full, 10 Operations)

**Shape Modes** (backed directly by Paper.js booleans):
- **Unite** (`path.unite`), **Minus Front** (`subtract`), **Intersect** (`intersect`), **Exclude** (`exclude`)

**Pathfinders** (built on boolean primitives + region logic):
- **Divide** — split all overlapping regions into separate faces
- **Trim** — remove hidden parts of lower objects; keep fills, no merge
- **Merge** — Trim, then unite same-colored adjacent regions
- **Crop** — keep only parts inside the topmost object
- **Outline** — convert to non-overlapping stroked line segments
- **Minus Back** — subtract all objects behind the front one

The four Shape Modes are near-free from Paper.js. The six Pathfinders are the **main custom engineering**: intersect all curves, collect resulting faces, group by containment/color. Highest-risk area → highest test coverage.

## Supporting Features

- **Fill & stroke**: color pickers + stroke width, live-applied to selection.
- **Layers panel**: list, rename, reorder (drag), show/hide, lock.
- **Export**: SVG (native) and PNG (raster at chosen scale).

## Testing Strategy

- **Pen state machine**: unit-tested headless — feed synthetic pointer events, assert the resulting Segment array (points + handles). No browser needed.
- **Pathfinder ops**: unit-tested per op on known input paths, asserting output geometry (area, segment count, winding). TDD-first.
- **Thin UI layer**: manual/smoke testing.

## Risks

1. **The six custom Pathfinders** (Divide/Trim/Merge/Crop/Outline/Minus Back) — genuine geometry work. Mitigation: build on Paper.js intersection primitives; TDD each one.
2. **Pen rubber-band + contextual cursors** — fiddly state. Mitigation: state-machine isolation, headless tests.

## Success Criteria

- Can draw an arbitrary bezier path with the Pen tool matching Illustrator's placing/editing/convert behaviors.
- Can select two or more paths and apply any of the 10 Pathfinder operations with correct geometry.
- Can style fill/stroke, organize with layers, and export valid SVG + PNG.
