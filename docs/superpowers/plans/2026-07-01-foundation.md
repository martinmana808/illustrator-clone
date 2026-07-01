# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable Next.js app with a Paper.js artboard, a Zustand UI store, and a typed geometry/document layer, so later features (Pen, Pathfinder, panels) have a tested foundation to build on.

**Architecture:** Next.js (App Router) renders a React shell. A single client component mounts a `<canvas>` and initializes one shared Paper.js `Project` (the geometry source of truth). A thin `engine` module wraps Paper.js setup, document creation, and path helpers so the rest of the app never touches Paper.js globals directly. A Zustand store holds UI-facing state (active tool, selection summary). Geometry-heavy helpers are pure and unit-tested headlessly with Vitest + Paper.js in Node.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, paper@0.12, zustand@5, Vitest.

## Global Constraints

- Language: TypeScript, `strict: true`.
- Paper.js is accessed ONLY through `src/engine/*` — no other module imports `paper` directly.
- Geometry helpers are pure functions (input paths → output), no rendering side-effects, so they run headless under Vitest.
- Node/paper in tests uses `paper.setup(new paper.Size(W, H))` with no canvas (headless mode).
- Package manager: npm.
- All new source under `src/`. Tests co-located as `*.test.ts` next to the unit or under `src/**/__tests__`.

---

### Task 1: Scaffold Next.js + TypeScript app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running dev server at `/` rendering a placeholder; scripts `dev`, `build`, `test`.

- [ ] **Step 1: Create the Next.js app non-interactively**

Run from the repo root (the directory already exists and has git + docs):
```bash
npx --yes create-next-app@latest . \
  --ts --app --src-dir --no-tailwind --eslint \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```
If create-next-app refuses because the directory is non-empty, answer its prompt to proceed (the existing `docs/`, `.git`, `.gitignore` must be preserved). If it still refuses, scaffold in a temp dir and copy files over, keeping existing `docs/`, `.git`, `.gitignore`.

- [ ] **Step 2: Verify it builds and runs**

Run:
```bash
npm run build
```
Expected: build completes with no errors; a `.next/` directory is produced.

- [ ] **Step 3: Replace the home page with an app placeholder**

Overwrite `src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <h1>Illustrator Clone — artboard loading…</h1>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript app"
```

---

### Task 2: Add dependencies and Vitest with a headless Paper.js smoke test

**Files:**
- Modify: `package.json` (deps + `test` script)
- Create: `vitest.config.ts`, `src/engine/__tests__/paper-headless.test.ts`

**Interfaces:**
- Consumes: Task 1 app.
- Produces: `npm test` runs Vitest; proof that Paper.js runs headless in Node (foundation for all geometry tests).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install paper@^0.12 zustand@^5
npm install -D vitest@^2
```

- [ ] **Step 2: Add the test script to package.json**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing headless Paper.js test**

Create `src/engine/__tests__/paper-headless.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import paper from "paper";

describe("paper headless", () => {
  it("computes area of a rectangle path without a canvas", () => {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(800, 600));
    const rect = new scope.Path.Rectangle({
      point: [0, 0],
      size: [10, 20],
    });
    expect(Math.abs(rect.area)).toBeCloseTo(200, 5);
  });
});
```

- [ ] **Step 5: Run the test**

Run:
```bash
npm test
```
Expected: PASS (proves Paper.js geometry works headless in Node).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add deps and headless Paper.js smoke test"
```

---

### Task 3: Geometry primitives module (pure helpers)

**Files:**
- Create: `src/engine/geometry.ts`, `src/engine/__tests__/geometry.test.ts`

**Interfaces:**
- Consumes: `paper` (allowed — this is under `src/engine`).
- Produces:
  - `export function pathArea(path: paper.Path): number` — absolute area.
  - `export function segmentCount(path: paper.Path): number`
  - `export function isClosed(path: paper.Path): boolean`
  - `export function clonePath(path: paper.Path): paper.Path`
  - These are used by Pathfinder tests later to assert output geometry.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/geometry.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import paper from "paper";
import { pathArea, segmentCount, isClosed, clonePath } from "../geometry";

beforeAll(() => {
  paper.setup(new paper.Size(800, 600));
});

describe("geometry helpers", () => {
  it("pathArea returns absolute area regardless of winding", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    expect(pathArea(r)).toBeCloseTo(200, 5);
  });

  it("segmentCount counts anchors", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    expect(segmentCount(r)).toBe(4);
  });

  it("isClosed reflects closed state", () => {
    const line = new paper.Path([
      [0, 0],
      [10, 0],
    ]);
    expect(isClosed(line)).toBe(false);
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [5, 5] });
    expect(isClosed(r)).toBe(true);
  });

  it("clonePath produces an equal but distinct path", () => {
    const r = new paper.Path.Rectangle({ point: [0, 0], size: [10, 20] });
    const c = clonePath(r);
    expect(c).not.toBe(r);
    expect(pathArea(c)).toBeCloseTo(pathArea(r), 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- geometry
```
Expected: FAIL — module `../geometry` not found.

- [ ] **Step 3: Implement the module**

Create `src/engine/geometry.ts`:
```ts
import paper from "paper";

/** Absolute area of a path, independent of winding direction. */
export function pathArea(path: paper.Path): number {
  return Math.abs(path.area);
}

/** Number of anchor points (segments) on a path. */
export function segmentCount(path: paper.Path): number {
  return path.segments.length;
}

/** Whether the path is closed. */
export function isClosed(path: paper.Path): boolean {
  return path.closed;
}

/** Deep clone that is not inserted into the active layer. */
export function clonePath(path: paper.Path): paper.Path {
  return path.clone({ insert: false }) as paper.Path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- geometry
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pure geometry helpers with headless tests"
```

---

### Task 4: Document/engine module — create project, layers, paths

**Files:**
- Create: `src/engine/document.ts`, `src/engine/__tests__/document.test.ts`

**Interfaces:**
- Consumes: `paper`, `src/engine/geometry`.
- Produces:
  - `export interface EditorDoc { scope: paper.PaperScope; project: paper.Project; }`
  - `export function createDocument(width: number, height: number): EditorDoc` — sets up an isolated `PaperScope` (so tests don't collide) and one default layer.
  - `export function addRectangle(doc: EditorDoc, x: number, y: number, w: number, h: number): paper.Path`
  - `export function activeLayerItemCount(doc: EditorDoc): number`
  - `export function toSVG(doc: EditorDoc): string`
  - Later tasks (canvas mount, Pen, Pathfinder) build on `createDocument`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/document.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createDocument, addRectangle, activeLayerItemCount, toSVG } from "../document";
import { pathArea } from "../geometry";

describe("document engine", () => {
  it("creates a document with an active layer", () => {
    const doc = createDocument(800, 600);
    expect(doc.project.layers.length).toBeGreaterThanOrEqual(1);
    expect(activeLayerItemCount(doc)).toBe(0);
  });

  it("adds a rectangle to the active layer", () => {
    const doc = createDocument(800, 600);
    const rect = addRectangle(doc, 10, 10, 30, 40);
    expect(activeLayerItemCount(doc)).toBe(1);
    expect(pathArea(rect)).toBeCloseTo(1200, 5);
  });

  it("serializes to SVG containing a path", () => {
    const doc = createDocument(800, 600);
    addRectangle(doc, 0, 0, 10, 10);
    const svg = toSVG(doc);
    expect(svg).toContain("<svg");
    expect(svg.toLowerCase()).toMatch(/<path|<rect/);
  });

  it("isolates scopes between documents", () => {
    const a = createDocument(100, 100);
    const b = createDocument(100, 100);
    addRectangle(a, 0, 0, 5, 5);
    expect(activeLayerItemCount(a)).toBe(1);
    expect(activeLayerItemCount(b)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- document
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/engine/document.ts`:
```ts
import paper from "paper";

export interface EditorDoc {
  scope: paper.PaperScope;
  project: paper.Project;
}

/**
 * Create an isolated editor document. Each document gets its own PaperScope so
 * multiple documents (and parallel tests) never share global state.
 */
export function createDocument(width: number, height: number): EditorDoc {
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(width, height));
  // setup() creates one default layer; ensure it exists.
  if (scope.project.layers.length === 0) {
    new scope.Layer();
  }
  return { scope, project: scope.project };
}

/** Add an axis-aligned rectangle path to the active layer. */
export function addRectangle(
  doc: EditorDoc,
  x: number,
  y: number,
  w: number,
  h: number
): paper.Path {
  doc.scope.activate();
  return new doc.scope.Path.Rectangle({
    point: [x, y],
    size: [w, h],
  }) as paper.Path;
}

/** Number of items on the active layer. */
export function activeLayerItemCount(doc: EditorDoc): number {
  return doc.project.activeLayer.children.length;
}

/** Serialize the whole project to an SVG string. */
export function toSVG(doc: EditorDoc): string {
  return doc.project.exportSVG({ asString: true }) as string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- document
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add document engine (create/add/serialize) with tests"
```

---

### Task 5: Zustand UI store

**Files:**
- Create: `src/state/store.ts`, `src/state/__tests__/store.test.ts`

**Interfaces:**
- Consumes: nothing from engine (UI-only state).
- Produces:
  - `export type ToolId = "select" | "direct-select" | "pen";`
  - `export interface EditorState { activeTool: ToolId; selectionCount: number; setTool(t: ToolId): void; setSelectionCount(n: number): void; }`
  - `export const useEditorStore` (zustand hook).
  - `export const editorStore` (vanilla store for non-React access from tools).

- [ ] **Step 1: Write the failing test**

Create `src/state/__tests__/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { editorStore } from "../store";

describe("editor store", () => {
  beforeEach(() => {
    editorStore.getState().setTool("select");
    editorStore.getState().setSelectionCount(0);
  });

  it("defaults to the select tool", () => {
    expect(editorStore.getState().activeTool).toBe("select");
  });

  it("switches tool", () => {
    editorStore.getState().setTool("pen");
    expect(editorStore.getState().activeTool).toBe("pen");
  });

  it("tracks selection count", () => {
    editorStore.getState().setSelectionCount(3);
    expect(editorStore.getState().selectionCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- store
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/state/store.ts`:
```ts
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type ToolId = "select" | "direct-select" | "pen";

export interface EditorState {
  activeTool: ToolId;
  selectionCount: number;
  setTool(t: ToolId): void;
  setSelectionCount(n: number): void;
}

export const editorStore = createStore<EditorState>((set) => ({
  activeTool: "select",
  selectionCount: 0,
  setTool: (t) => set({ activeTool: t }),
  setSelectionCount: (n) => set({ selectionCount: n }),
}));

export function useEditorStore<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore, selector);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- store
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add zustand editor store with tests"
```

---

### Task 6: Canvas mount — live Paper.js artboard in the browser

**Files:**
- Create: `src/engine/browser.ts`, `src/components/ArtboardCanvas.tsx`, `src/components/Toolbar.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `createDocument`, `addRectangle` (engine); `useEditorStore` (state).
- Produces:
  - `export function attachToCanvas(canvas: HTMLCanvasElement, width: number, height: number): EditorDoc` — like `createDocument` but binds the scope to a real canvas so it renders.
  - A visible artboard with a demo rectangle + a toolbar that switches the active tool (proves the store↔UI wiring).

Note: this task is browser-only glue and is verified manually (not unit-tested), consistent with the spec's "thin UI layer: manual/smoke testing."

- [ ] **Step 1: Add the browser attach helper**

Create `src/engine/browser.ts`:
```ts
import paper from "paper";
import type { EditorDoc } from "./document";

/** Initialize a PaperScope bound to a real canvas so drawing is visible. */
export function attachToCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): EditorDoc {
  const scope = new paper.PaperScope();
  scope.setup(canvas);
  scope.view.viewSize = new scope.Size(width, height);
  if (scope.project.layers.length === 0) {
    new scope.Layer();
  }
  return { scope, project: scope.project };
}
```

- [ ] **Step 2: Build the Toolbar component**

Create `src/components/Toolbar.tsx`:
```tsx
"use client";

import { useEditorStore } from "@/state/store";
import type { ToolId } from "@/state/store";

const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "direct-select", label: "Direct Select", key: "A" },
  { id: "pen", label: "Pen", key: "P" },
];

export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? "tool active" : "tool"}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build the ArtboardCanvas component**

Create `src/components/ArtboardCanvas.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { attachToCanvas } from "@/engine/browser";
import { addRectangle } from "@/engine/document";

const W = 900;
const H = 600;

export function ArtboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const doc = attachToCanvas(canvas, W, H);
    // Demo content to prove rendering works; removed once tools land.
    const rect = addRectangle(doc, 60, 60, 200, 140);
    rect.fillColor = new doc.scope.Color(0.85, 0.9, 1);
    rect.strokeColor = new doc.scope.Color(0.1, 0.2, 0.4);
    rect.strokeWidth = 2;
    doc.scope.view.update();
    return () => {
      doc.scope.project.clear();
      doc.scope.view.remove();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="artboard"
      // Paper.js manages the pixel ratio; fixed CSS size keeps 1:1 for now.
      style={{ width: W, height: H }}
    />
  );
}
```

- [ ] **Step 4: Wire them into the page**

Overwrite `src/app/page.tsx`:
```tsx
import { Toolbar } from "@/components/Toolbar";
import { ArtboardCanvas } from "@/components/ArtboardCanvas";

export default function Home() {
  return (
    <main className="editor">
      <Toolbar />
      <div className="stage">
        <ArtboardCanvas />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Add minimal layout styles**

Append to `src/app/globals.css`:
```css
.editor {
  display: grid;
  grid-template-columns: 160px 1fr;
  height: 100vh;
}
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #f4f4f5;
  border-right: 1px solid #d4d4d8;
}
.tool {
  padding: 8px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.tool.active {
  background: #e0e7ff;
  border-color: #6366f1;
}
.stage {
  display: grid;
  place-items: center;
  background: #e4e4e7;
  overflow: auto;
}
.artboard {
  background: #ffffff;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.15);
}
```

- [ ] **Step 6: Manually verify in the browser**

Run:
```bash
npm run dev
```
Open the shown URL. Expected: a toolbar on the left with three tools (Select highlighted); an artboard with a light-blue rectangle with a dark border. Clicking a tool moves the highlight.

- [ ] **Step 7: Verify production build still passes**

Run:
```bash
npm run build
```
Expected: build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: mount live Paper.js artboard with tool-switching toolbar"
```

---

## Self-Review

**Spec coverage (foundation portion):**
- Stack (Next.js/React/Paper.js/Zustand/Vitest) → Tasks 1, 2, 5. ✓
- Paper.js accessed only via `src/engine/*` → enforced by module layout (Tasks 3, 4, 6). ✓
- Data model (Project/Layer/Path/Segment) → `createDocument`/`addRectangle` expose Project+Layer+Path (Task 4); Segment editing arrives with the Pen plan. ✓ (foundation subset)
- Headless testability of geometry → Tasks 2–4 prove Paper.js runs in Node. ✓
- Export (SVG) groundwork → `toSVG` (Task 4); full export UI is Plan 5. ✓
- Tool state for later tools → store `ToolId` includes select/direct-select/pen (Task 5). ✓

Out of this plan by design (covered by later plans): Pen tool, selection tools, Pathfinder, fill/stroke UI, layers panel, PNG export. This plan intentionally delivers only the foundation.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `EditorDoc` shape (`{ scope, project }`) is identical in `document.ts` and consumed unchanged in `browser.ts`/components. `ToolId` union defined once in `store.ts` and reused in `Toolbar.tsx`. `createDocument`/`attachToCanvas` both return `EditorDoc`. ✓
