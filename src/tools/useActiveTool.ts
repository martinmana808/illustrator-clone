import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import { PenTool } from "./pen";
import { SelectTool } from "./select";
import { DirectSelectTool } from "./directSelect";
import type { Modifiers, Vec, ToolController } from "./types";
import { editorStore } from "@/state/store";
import { applyPathfinder, type PathfinderOp, type PItem } from "@/engine/pathfinder";
import { applyFill, applyStroke, applyStrokeWidth, readStyle } from "@/engine/style";
import {
  listLayers,
  addLayer as addLayerFn,
  renameLayer as renameLayerFn,
  setLayerVisible,
  setLayerLocked,
  moveLayer as moveLayerFn,
} from "@/engine/layers";
import { downloadSVG, downloadPNG } from "@/engine/export";
import { History } from "@/engine/history";

function mods(event: paper.ToolEvent | paper.KeyEvent): Modifiers {
  const k = (event.modifiers ?? {}) as Record<string, boolean>;
  return {
    shift: k.shift,
    alt: k.option || k.alt,
    meta: k.command || k.meta,
    ctrl: k.control,
  };
}
function vec(pt: paper.Point): Vec {
  return { x: pt.x, y: pt.y };
}

/**
 * Attach a Paper.js Tool that routes pointer/keyboard events to the active
 * tool (Pen or Select), draws the Pen rubber-band overlay, and exposes
 * `runPathfinder` so the panel can operate on the current selection.
 */
export function installTools(doc: EditorDoc): ToolController {
  const scope = doc.scope;
  scope.activate();
  const pen = new PenTool(doc);
  const select = new SelectTool(doc);
  const directSelect = new DirectSelectTool(doc);
  const tool = new scope.Tool();
  let overlay: paper.Path | null = null;

  const active = () => editorStore.getState().activeTool;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());
  const sel = () => select.selection;
  const history = new History(doc);
  const commit = () => {
    history.capture();
    emit();
  };
  const syncSelection = () => {
    editorStore.getState().setSelectionCount(select.selection.length);
    emit();
  };

  function drawPreview() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (active() === "pen") {
      const p = pen.previewPoint;
      const path = pen.currentPath;
      if (p && path && path.lastSegment) {
        overlay = new scope.Path({
          segments: [path.lastSegment.point, new scope.Point(p.x, p.y)],
          strokeColor: new scope.Color(0.4, 0.4, 0.9),
          dashArray: [4, 4],
        });
      }
    }
    scope.view.update();
  }

  tool.onMouseDown = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerDown(vec(e.point), mods(e));
      drawPreview();
    } else if (active() === "select") {
      select.pointerDown(vec(e.point), mods(e));
      scope.view.update();
      syncSelection();
    } else if (active() === "direct-select") {
      directSelect.pointerDown(vec(e.point), mods(e));
      scope.view.update();
    }
  };
  tool.onMouseDrag = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerDrag(vec(e.point), mods(e));
      scope.view.update();
    } else if (active() === "select") {
      select.pointerDrag(vec(e.point), mods(e));
      scope.view.update();
    } else if (active() === "direct-select") {
      directSelect.pointerDrag(vec(e.point), mods(e));
      scope.view.update();
    }
  };
  tool.onMouseUp = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerUp(vec(e.point), mods(e));
      commit();
    } else if (active() === "select") {
      select.pointerUp(vec(e.point), mods(e));
      scope.view.update();
      syncSelection();
      commit();
    } else if (active() === "direct-select") {
      directSelect.pointerUp(vec(e.point), mods(e));
      scope.view.update();
      commit();
    }
  };
  tool.onMouseMove = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerMove(vec(e.point), mods(e));
      drawPreview();
    }
  };
  tool.onKeyDown = (e: paper.KeyEvent) => {
    if (active() === "pen" && (e.key === "enter" || e.key === "escape")) {
      pen.finish();
      drawPreview();
    }
    if (active() === "select" && (e.key === "delete" || e.key === "backspace")) {
      select.deleteSelection();
      scope.view.update();
      syncSelection();
      commit();
    }
  };

  function runPathfinder(op: PathfinderOp) {
    const items = select.selection.filter(
      (it) => typeof (it as unknown as PItem).unite === "function"
    ) as unknown as PItem[];
    if (items.length < 1) return;
    const result = applyPathfinder(op, items);
    items.forEach((it) => (it as unknown as paper.Item).remove());
    result.forEach((r) => {
      scope.project.activeLayer.addChild(r as unknown as paper.Item);
      (r as unknown as paper.Item).selected = true;
    });
    scope.view.update();
    editorStore.getState().setSelectionCount(result.length);
    commit();
  }

  const afterRestore = () => {
    scope.view.update();
    editorStore.getState().setSelectionCount(select.selection.length);
    emit();
  };

  tool.activate();
  return {
    teardown: () => {
      if (overlay) overlay.remove();
      tool.remove();
      listeners.clear();
    },
    runPathfinder,
    setFill: (css) => {
      applyFill(sel(), css);
      scope.view.update();
      commit();
    },
    setStroke: (css) => {
      applyStroke(sel(), css);
      scope.view.update();
      commit();
    },
    setStrokeWidth: (w) => {
      applyStrokeWidth(sel(), w);
      scope.view.update();
      commit();
    },
    readSelectionStyle: () => readStyle(sel()),
    layers: () => listLayers(doc),
    addLayer: (name) => {
      addLayerFn(doc, name);
      commit();
    },
    renameLayer: (id, name) => {
      // No history capture per keystroke; rename is committed on next edit.
      renameLayerFn(doc, id, name);
      emit();
    },
    toggleLayerVisible: (id) => {
      const info = listLayers(doc).find((l) => l.id === id);
      if (info) setLayerVisible(doc, id, !info.visible);
      scope.view.update();
      commit();
    },
    toggleLayerLocked: (id) => {
      const info = listLayers(doc).find((l) => l.id === id);
      if (info) setLayerLocked(doc, id, !info.locked);
      commit();
    },
    moveLayer: (id, dir) => {
      moveLayerFn(doc, id, dir);
      scope.view.update();
      commit();
    },
    exportSVG: () => downloadSVG(doc),
    exportPNG: () => downloadPNG(doc),
    undo: () => {
      if (history.undo()) afterRestore();
    },
    redo: () => {
      if (history.redo()) afterRestore();
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    onChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

