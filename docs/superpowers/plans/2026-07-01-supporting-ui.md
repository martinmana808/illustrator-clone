# Supporting UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Round out v0 with fill/stroke styling on the selection, a Layers panel (rename/reorder/show/hide/lock), and export to SVG + PNG — completing the scope agreed in the design.

**Architecture:** Pure engine helpers in `src/engine/style.ts`, `src/engine/layers.ts`, and `src/engine/export.ts` operate on the Paper document and are unit-tested headlessly. React panels (`StylePanel`, `LayersPanel`, `ExportBar`) call these through the existing store `controller`, which gains a few methods. No changes to the Pen/Pathfinder engines.

**Tech Stack:** Paper.js, React, Zustand, Vitest (jsdom + stubbed canvas).

## Global Constraints

- Paper.js only via `src/engine/*`.
- Engine helpers are pure functions over `EditorDoc` / items; unit-tested.
- PNG export needs a real canvas (`view.element.toDataURL`) → tested manually in the browser; SVG export is unit-tested.
- Controller methods added: `setFill`, `setStroke`, `setStrokeWidth`, `getLayers`, `addLayer`, `renameLayer`, `toggleLayerVisible`, `toggleLayerLocked`, `reorderLayer`, `exportSVG`, `exportPNG`, plus a `subscribe(cb)` so panels re-render on document change.

---

### Task 1: Style helpers (fill / stroke / width on selection)

**Files:**
- Create: `src/engine/style.ts`, `src/engine/__tests__/style.test.ts`

**Interfaces (Produces):**
- `applyFill(items: paper.Item[], cssColor: string | null): void`
- `applyStroke(items: paper.Item[], cssColor: string | null): void`
- `applyStrokeWidth(items: paper.Item[], width: number): void`
- `readStyle(items: paper.Item[]): { fill: string | null; stroke: string | null; strokeWidth: number | null }` — common value or null when mixed/empty.

- [ ] **Step 1: Write failing tests** — `src/engine/__tests__/style.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createDocument, addRectangle } from "@/engine/document";
import { applyFill, applyStroke, applyStrokeWidth, readStyle } from "../style";

describe("style helpers", () => {
  it("applyFill sets fillColor and readStyle reports it", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10);
    applyFill([r], "#ff0000");
    expect(r.fillColor).not.toBeNull();
    expect(readStyle([r]).fill).toBe("#ff0000");
  });

  it("applyStroke + width set stroke props", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10);
    applyStroke([r], "#0000ff");
    applyStrokeWidth([r], 3);
    const s = readStyle([r]);
    expect(s.stroke).toBe("#0000ff");
    expect(s.strokeWidth).toBe(3);
  });

  it("readStyle returns null fill when items disagree", () => {
    const doc = createDocument(200, 200);
    const a = addRectangle(doc, 0, 0, 10, 10);
    const b = addRectangle(doc, 20, 20, 10, 10);
    applyFill([a], "#ff0000");
    applyFill([b], "#00ff00");
    expect(readStyle([a, b]).fill).toBeNull();
  });

  it("applyFill(null) clears the fill", () => {
    const doc = createDocument(200, 200);
    const r = addRectangle(doc, 0, 0, 10, 10);
    applyFill([r], "#ff0000");
    applyFill([r], null);
    expect(r.fillColor).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/engine/style.ts`:

```ts
import type paper from "paper";

type Styleable = paper.Item & {
  fillColor: paper.Color | null;
  strokeColor: paper.Color | null;
  strokeWidth: number;
};

function toHex(color: paper.Color | null): string | null {
  if (!color) return null;
  // paper.Color#toCSS(true) → "#rrggbb"
  return color.toCSS(true);
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

export function readStyle(items: paper.Item[]): {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
} {
  const s = items as Styleable[];
  return {
    fill: common(s.map((it) => toHex(it.fillColor))),
    stroke: common(s.map((it) => toHex(it.strokeColor))),
    strokeWidth: common(s.map((it) => it.strokeWidth ?? null)),
  };
}
```

Note: assigning a CSS string to `fillColor` is valid at runtime in Paper (it parses the string in the item's scope); the cast satisfies TypeScript.

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: style helpers (fill/stroke/width + readStyle)`.

---

### Task 2: Layer helpers

**Files:**
- Create: `src/engine/layers.ts`, `src/engine/__tests__/layers.test.ts`

**Interfaces (Produces):**
- `interface LayerInfo { id: number; name: string; visible: boolean; locked: boolean; }`
- `listLayers(doc: EditorDoc): LayerInfo[]` — top layer first (reverse of paper order).
- `addLayer(doc: EditorDoc, name?: string): paper.Layer`
- `renameLayer(doc: EditorDoc, id: number, name: string): void`
- `setLayerVisible(doc: EditorDoc, id: number, visible: boolean): void`
- `setLayerLocked(doc: EditorDoc, id: number, locked: boolean): void`
- `moveLayer(doc: EditorDoc, id: number, dir: -1 | 1): void` — reorder up/down in z.

- [ ] **Step 1: Write failing tests** — `src/engine/__tests__/layers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import { listLayers, addLayer, renameLayer, setLayerVisible, setLayerLocked, moveLayer } from "../layers";

describe("layer helpers", () => {
  it("lists the default layer", () => {
    const doc = createDocument(200, 200);
    const layers = listLayers(doc);
    expect(layers.length).toBe(1);
  });

  it("addLayer creates a named layer at top", () => {
    const doc = createDocument(200, 200);
    addLayer(doc, "Sketch");
    const layers = listLayers(doc);
    expect(layers.length).toBe(2);
    expect(layers[0].name).toBe("Sketch"); // top first
  });

  it("rename / visible / locked mutate the layer", () => {
    const doc = createDocument(200, 200);
    const l = addLayer(doc, "L");
    renameLayer(doc, l.id, "Renamed");
    setLayerVisible(doc, l.id, false);
    setLayerLocked(doc, l.id, true);
    const info = listLayers(doc).find((x) => x.id === l.id)!;
    expect(info.name).toBe("Renamed");
    expect(info.visible).toBe(false);
    expect(info.locked).toBe(true);
  });

  it("moveLayer changes z-order", () => {
    const doc = createDocument(200, 200);
    const a = addLayer(doc, "A");
    addLayer(doc, "B"); // B on top
    // A is below B; move A up → A becomes top
    moveLayer(doc, a.id, 1);
    expect(listLayers(doc)[0].name).toBe("A");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/engine/layers.ts`:

```ts
import type paper from "paper";
import type { EditorDoc } from "./document";

export interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
}

function findLayer(doc: EditorDoc, id: number): paper.Layer | undefined {
  return doc.project.layers.find((l) => l.id === id);
}

export function listLayers(doc: EditorDoc): LayerInfo[] {
  // Paper stores back-to-front; UI wants top (front) first.
  return doc.project.layers
    .map((l, i) => ({
      id: l.id,
      name: l.name || `Layer ${i + 1}`,
      visible: l.visible,
      locked: l.locked,
    }))
    .reverse();
}

export function addLayer(doc: EditorDoc, name?: string): paper.Layer {
  doc.scope.activate();
  const layer = new doc.scope.Layer();
  if (name) layer.name = name;
  layer.activate();
  return layer;
}

export function renameLayer(doc: EditorDoc, id: number, name: string): void {
  const l = findLayer(doc, id);
  if (l) l.name = name;
}

export function setLayerVisible(doc: EditorDoc, id: number, visible: boolean): void {
  const l = findLayer(doc, id);
  if (l) l.visible = visible;
}

export function setLayerLocked(doc: EditorDoc, id: number, locked: boolean): void {
  const l = findLayer(doc, id);
  if (l) l.locked = locked;
}

export function moveLayer(doc: EditorDoc, id: number, dir: -1 | 1): void {
  const layers = doc.project.layers;
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const target = idx + dir; // +1 = up in z (towards front)
  if (target < 0 || target >= layers.length) return;
  const layer = layers[idx];
  const sibling = layers[target];
  if (dir === 1) layer.insertAbove(sibling);
  else layer.insertBelow(sibling);
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: layer helpers (list/add/rename/visible/locked/move)`.

---

### Task 3: Export helpers (SVG unit-tested, PNG signature)

**Files:**
- Create: `src/engine/export.ts`, `src/engine/__tests__/export.test.ts`

**Interfaces (Produces):**
- `exportSVGString(doc: EditorDoc): string`
- `exportPNGDataURL(doc: EditorDoc, scale?: number): string` — uses `view.element.toDataURL`; returns "" if unavailable (headless).
- `downloadDataUrl(filename: string, dataUrl: string): void` — browser-only DOM anchor click (guarded by `typeof document`).

- [ ] **Step 1: Write failing tests** — `src/engine/__tests__/export.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createDocument, addRectangle } from "@/engine/document";
import { exportSVGString } from "../export";

describe("export helpers", () => {
  it("exportSVGString includes drawn geometry", () => {
    const doc = createDocument(200, 200);
    addRectangle(doc, 10, 10, 50, 50);
    const svg = exportSVGString(doc);
    expect(svg).toContain("<svg");
    expect(svg.toLowerCase()).toMatch(/<path|<rect/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/engine/export.ts`:

```ts
import type { EditorDoc } from "./document";

export function exportSVGString(doc: EditorDoc): string {
  return doc.project.exportSVG({ asString: true }) as string;
}

export function exportPNGDataURL(doc: EditorDoc, scale = 1): string {
  const el = doc.scope.view.element as HTMLCanvasElement | undefined;
  if (!el || typeof el.toDataURL !== "function") return "";
  if (scale === 1) return el.toDataURL("image/png");
  // Redraw at higher resolution into an offscreen canvas.
  const off = document.createElement("canvas");
  off.width = el.width * scale;
  off.height = el.height * scale;
  const ctx = off.getContext("2d");
  if (!ctx) return el.toDataURL("image/png");
  ctx.drawImage(el, 0, 0, off.width, off.height);
  return off.toDataURL("image/png");
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  if (typeof document === "undefined" || !dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadSVG(doc: EditorDoc, filename = "artwork.svg"): void {
  const svg = exportSVGString(doc);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  downloadDataUrl(filename, url);
}

export function downloadPNG(doc: EditorDoc, filename = "artwork.png", scale = 2): void {
  const url = exportPNGDataURL(doc, scale);
  downloadDataUrl(filename, url);
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `feat: export helpers (SVG string tested, PNG + downloads)`.

---

### Task 4: Extend the controller + store for style/layers/export

**Files:**
- Modify: `src/tools/types.ts` (extend `ToolController`), `src/tools/useActiveTool.ts`, `src/state/store.ts`

**Interfaces (Produces):** `ToolController` gains:
```ts
setFill(css: string | null): void;
setStroke(css: string | null): void;
setStrokeWidth(w: number): void;
readSelectionStyle(): { fill: string | null; stroke: string | null; strokeWidth: number | null };
layers(): LayerInfo[];
addLayer(name?: string): void;
renameLayer(id: number, name: string): void;
toggleLayerVisible(id: number): void;
toggleLayerLocked(id: number): void;
moveLayer(id: number, dir: -1 | 1): void;
exportSVG(): void;
exportPNG(): void;
onChange(cb: () => void): () => void; // subscribe for panel refresh
```

- [ ] **Step 1:** Extend `ToolController` in `src/tools/types.ts`:

```ts
import type { LayerInfo } from "@/engine/layers";

export interface ToolController {
  teardown: () => void;
  runPathfinder: (op: PathfinderOp) => void;
  setFill(css: string | null): void;
  setStroke(css: string | null): void;
  setStrokeWidth(w: number): void;
  readSelectionStyle(): { fill: string | null; stroke: string | null; strokeWidth: number | null };
  layers(): LayerInfo[];
  addLayer(name?: string): void;
  renameLayer(id: number, name: string): void;
  toggleLayerVisible(id: number): void;
  toggleLayerLocked(id: number): void;
  moveLayer(id: number, dir: -1 | 1): void;
  exportSVG(): void;
  exportPNG(): void;
  onChange(cb: () => void): () => void;
}
```

- [ ] **Step 2:** In `useActiveTool.ts`, add a lightweight change emitter and implement the methods, then include them in the returned controller. Add near the top of `installTools`:

```ts
import { applyFill, applyStroke, applyStrokeWidth, readStyle } from "@/engine/style";
import {
  listLayers, addLayer as addLayerFn, renameLayer as renameLayerFn,
  setLayerVisible, setLayerLocked, moveLayer as moveLayerFn, type LayerInfo,
} from "@/engine/layers";
import { downloadSVG, downloadPNG } from "@/engine/export";
```

Inside `installTools`, before `return`:

```ts
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());
  const sel = () => select.selection;

  const layerVisibleState = new Map<number, boolean>();
```

Then add to the returned object (merge with existing `teardown`/`runPathfinder`):

```ts
    setFill: (css) => { applyFill(sel(), css); scope.view.update(); emit(); },
    setStroke: (css) => { applyStroke(sel(), css); scope.view.update(); emit(); },
    setStrokeWidth: (w) => { applyStrokeWidth(sel(), w); scope.view.update(); emit(); },
    readSelectionStyle: () => readStyle(sel()),
    layers: () => listLayers(doc),
    addLayer: (name) => { addLayerFn(doc, name); emit(); },
    renameLayer: (id, name) => { renameLayerFn(doc, id, name); emit(); },
    toggleLayerVisible: (id) => {
      const info = listLayers(doc).find((l) => l.id === id);
      if (info) setLayerVisible(doc, id, !info.visible);
      scope.view.update(); emit();
    },
    toggleLayerLocked: (id) => {
      const info = listLayers(doc).find((l) => l.id === id);
      if (info) setLayerLocked(doc, id, !info.locked);
      emit();
    },
    moveLayer: (id, dir) => { moveLayerFn(doc, id, dir); scope.view.update(); emit(); },
    exportSVG: () => downloadSVG(doc),
    exportPNG: () => downloadPNG(doc),
    onChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
```

Also call `emit()` at the end of `runPathfinder` and after select mouseUp so panels refresh. (Add `emit()` after `syncSelection()` in the select branches and at the end of `runPathfinder`.)

Remove the unused `layerVisibleState`/`LayerInfo` if not needed; keep imports that are used.

- [ ] **Step 3:** Build to typecheck: `npm run build`. Fix any unused-import lint errors.

- [ ] **Step 4: Commit** — `feat: extend controller with style/layers/export methods`.

---

### Task 5: Style panel

**Files:**
- Create: `src/components/StylePanel.tsx`
- Modify: `src/components/EditorShell.tsx` (add to right rail, above Pathfinder), `globals.css`

Browser glue — verified manually + Playwright.

- [ ] **Step 1:** Create `src/components/StylePanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";

export function StylePanel() {
  const count = useEditorStore((s) => s.selectionCount);
  const controller = useEditorStore((s) => s.controller);
  const [fill, setFill] = useState("#cccccc");
  const [stroke, setStroke] = useState("#000000");
  const [width, setWidth] = useState(1);

  useEffect(() => {
    if (!controller) return;
    const sync = () => {
      const s = controller.readSelectionStyle();
      if (s.fill) setFill(s.fill);
      if (s.stroke) setStroke(s.stroke);
      if (s.strokeWidth != null) setWidth(s.strokeWidth);
    };
    sync();
    return controller.onChange(sync);
  }, [controller, count]);

  const disabled = count < 1;
  return (
    <div className="panel">
      <div className="panel-title">Appearance</div>
      <label className="style-row">
        <span>Fill</span>
        <input type="color" value={fill} disabled={disabled}
          onChange={(e) => { setFill(e.target.value); editorStore.getState().controller?.setFill(e.target.value); }} />
        <button className="mini" disabled={disabled}
          onClick={() => editorStore.getState().controller?.setFill(null)}>none</button>
      </label>
      <label className="style-row">
        <span>Stroke</span>
        <input type="color" value={stroke} disabled={disabled}
          onChange={(e) => { setStroke(e.target.value); editorStore.getState().controller?.setStroke(e.target.value); }} />
        <button className="mini" disabled={disabled}
          onClick={() => editorStore.getState().controller?.setStroke(null)}>none</button>
      </label>
      <label className="style-row">
        <span>Weight</span>
        <input type="range" min={0} max={20} step={0.5} value={width} disabled={disabled}
          onChange={(e) => { const w = Number(e.target.value); setWidth(w); editorStore.getState().controller?.setStrokeWidth(w); }} />
        <span className="mono">{width}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2:** Add to `EditorShell` right rail (a wrapper div stacking StylePanel, LayersPanel, PathfinderPanel). Change the third grid column to hold a scrollable stack. Update `.editor` right column width to 220px and wrap panels in `<div className="rail">`.

- [ ] **Step 3:** Add CSS `.style-row`, `.mini`, `.mono`, `.rail` to `globals.css`.

- [ ] **Step 4:** `npm run build`; Playwright: draw a shape, select it, change fill color, screenshot shows filled shape.

- [ ] **Step 5: Commit** — `feat: Appearance (fill/stroke/weight) panel`.

---

### Task 6: Layers panel

**Files:**
- Create: `src/components/LayersPanel.tsx`
- Modify: `EditorShell.tsx`, `globals.css`

- [ ] **Step 1:** Create `src/components/LayersPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";
import type { LayerInfo } from "@/engine/layers";

export function LayersPanel() {
  const controller = useEditorStore((s) => s.controller);
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    if (!controller) return;
    const sync = () => setLayers(controller.layers());
    sync();
    return controller.onChange(sync);
  }, [controller]);

  const c = () => editorStore.getState().controller;

  return (
    <div className="panel">
      <div className="panel-title">
        Layers
        <button className="mini" onClick={() => c()?.addLayer()}>+</button>
      </div>
      <ul className="layer-list">
        {layers.map((l) => (
          <li key={l.id} className="layer-row">
            <button className="mini" title="visibility"
              onClick={() => c()?.toggleLayerVisible(l.id)}>{l.visible ? "👁" : "—"}</button>
            <button className="mini" title="lock"
              onClick={() => c()?.toggleLayerLocked(l.id)}>{l.locked ? "🔒" : "🔓"}</button>
            <input className="layer-name" value={l.name}
              onChange={(e) => c()?.renameLayer(l.id, e.target.value)} />
            <button className="mini" onClick={() => c()?.moveLayer(l.id, 1)}>▲</button>
            <button className="mini" onClick={() => c()?.moveLayer(l.id, -1)}>▼</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2:** Add `<LayersPanel />` to the rail in `EditorShell`. Add CSS `.layer-list`, `.layer-row`, `.layer-name`.

- [ ] **Step 3:** `npm run build`; Playwright: add a layer, screenshot shows two rows.

- [ ] **Step 4: Commit** — `feat: Layers panel (add/rename/visible/lock/reorder)`.

---

### Task 7: Export bar

**Files:**
- Create: `src/components/ExportBar.tsx`
- Modify: `EditorShell.tsx`, `globals.css`

- [ ] **Step 1:** Create `src/components/ExportBar.tsx`:

```tsx
"use client";

import { editorStore } from "@/state/store";

export function ExportBar() {
  return (
    <div className="panel">
      <div className="panel-title">Export</div>
      <div className="pf-grid">
        <button className="pf-btn" onClick={() => editorStore.getState().controller?.exportSVG()}>SVG</button>
        <button className="pf-btn" onClick={() => editorStore.getState().controller?.exportPNG()}>PNG</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Add `<ExportBar />` to the rail in `EditorShell`.

- [ ] **Step 3:** `npm run build`; Playwright: click SVG, intercept the download (or assert no error). Manual: confirm files download.

- [ ] **Step 4: Commit** — `feat: Export bar (SVG/PNG download)`.

---

## Self-Review

**Spec coverage (supporting features):**
- Fill & stroke styling → Tasks 1, 5. ✓
- Layers panel (list/rename/reorder/show-hide/lock) → Tasks 2, 6. ✓
- Export SVG + PNG → Tasks 3, 7. ✓

**Placeholder scan:** none — all component and helper code is complete.

**Type consistency:** `LayerInfo` defined once in `layers.ts`, reused in types/panel. `ToolController` extended in one place; all new methods implemented in `useActiveTool.ts`. `readStyle` return shape identical in `style.ts`, `ToolController`, and both panels. ✓

**Risk note:** PNG export at scale relies on `view.element.toDataURL`, only present in the browser; unit tests cover SVG only, PNG verified manually. If the artboard uses a devicePixelRatio transform, PNG scale may double-apply — verify the exported pixel size in the browser and adjust `scale` if needed.
