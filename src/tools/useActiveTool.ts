import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import { PenTool } from "./pen";
import type { Modifiers, Vec } from "./types";
import { editorStore } from "@/state/store";

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
 * Attach a Paper.js Tool that forwards pointer/keyboard events into the active
 * tool instance (currently the Pen) and draws the rubber-band preview overlay.
 * Returns a teardown function.
 */
export function installTools(doc: EditorDoc): () => void {
  const scope = doc.scope;
  scope.activate();
  const pen = new PenTool(doc);
  const tool = new scope.Tool();
  let overlay: paper.Path | null = null;

  function drawPreview() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (editorStore.getState().activeTool !== "pen") {
      scope.view.update();
      return;
    }
    const p = pen.previewPoint;
    const path = pen.currentPath;
    if (p && path && path.lastSegment) {
      overlay = new scope.Path({
        segments: [path.lastSegment.point, new scope.Point(p.x, p.y)],
        strokeColor: new scope.Color(0.4, 0.4, 0.9),
        dashArray: [4, 4],
      });
    }
    scope.view.update();
  }

  const isPen = () => editorStore.getState().activeTool === "pen";

  tool.onMouseDown = (e: paper.ToolEvent) => {
    if (!isPen()) return;
    pen.pointerDown(vec(e.point), mods(e));
    drawPreview();
  };
  tool.onMouseDrag = (e: paper.ToolEvent) => {
    if (!isPen()) return;
    pen.pointerDrag(vec(e.point), mods(e));
    scope.view.update();
  };
  tool.onMouseUp = (e: paper.ToolEvent) => {
    if (!isPen()) return;
    pen.pointerUp(vec(e.point), mods(e));
  };
  tool.onMouseMove = (e: paper.ToolEvent) => {
    if (!isPen()) return;
    pen.pointerMove(vec(e.point), mods(e));
    drawPreview();
  };
  tool.onKeyDown = (e: paper.KeyEvent) => {
    if (e.key === "enter" || e.key === "escape") {
      pen.finish();
      drawPreview();
    }
  };

  tool.activate();
  return () => {
    if (overlay) overlay.remove();
    tool.remove();
  };
}
