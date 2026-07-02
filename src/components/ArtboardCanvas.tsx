"use client";

import { useEffect, useRef } from "react";
import { attachToCanvas } from "@/engine/browser";
import { installTools } from "@/tools/useActiveTool";
import { editorStore } from "@/state/store";
import type { ToolId } from "@/state/store";

export function ArtboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mount Paper filling the panel; track resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth || 900;
    const h = wrap.clientHeight || 600;
    canvas.width = w;
    canvas.height = h;
    const doc = attachToCanvas(canvas, w, h);
    const controller = installTools(doc);
    editorStore.getState().setController(controller);
    controller.fitArtboard();
    doc.scope.view.update();

    const onResize = () => {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      canvas.width = nw;
      canvas.height = nh;
      doc.scope.view.viewSize = new doc.scope.Size(nw, nh);
      doc.scope.view.update();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      controller.teardown();
      editorStore.getState().setController(null);
      doc.scope.project.clear();
      doc.scope.view.remove();
    };
  }, []);

  // Wheel: ⌘/ctrl+wheel (or pinch) = zoom at cursor; wheel = pan; shift+wheel = horizontal.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const c = editorStore.getState().controller;
      if (!c) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        c.zoomAtClient(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
      } else if (e.shiftKey) {
        c.panBy(-e.deltaY, 0);
      } else {
        c.panBy(-e.deltaX, -e.deltaY);
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Hold Space → temporary Hand tool.
  useEffect(() => {
    let prev: ToolId | null = null;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (prev === null) {
        prev = editorStore.getState().activeTool;
        editorStore.getState().setTool("hand");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (prev !== null) {
        editorStore.getState().setTool(prev);
        prev = null;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Tool shortcuts + zoom shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const c = editorStore.getState().controller;
      const key = e.key;
      const k = key.toLowerCase();

      // While actively typing, keystrokes go into the text.
      const t0 = editorStore.getState().activeTool;
      if ((t0 === "type" || t0 === "type-on-path") && c?.isTyping()) {
        if (key === "Escape") {
          c.finishTyping();
          e.preventDefault();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (key === "ArrowLeft") {
          c.caretMove(-1);
          e.preventDefault();
          return;
        }
        if (key === "ArrowRight") {
          c.caretMove(1);
          e.preventDefault();
          return;
        }
        if (key.length === 1 || key === "Backspace" || key === "Enter") {
          c.typeKey(key);
          e.preventDefault();
          return;
        }
        return;
      }

      // Zoom shortcuts.
      if ((e.metaKey || e.ctrlKey) && (k === "=" || k === "+")) {
        e.preventDefault();
        c?.zoomIn();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "-") {
        e.preventDefault();
        c?.zoomOut();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "0") {
        e.preventDefault();
        c?.fitArtboard();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "1") {
        e.preventDefault();
        c?.actualSize();
        return;
      }
      // Undo / redo.
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) c?.redo();
        else c?.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (k === "c" && e.shiftKey) {
        editorStore.getState().setTool("anchor-point");
        return;
      }
      if (k === "v") editorStore.getState().setTool("select");
      if (k === "a") editorStore.getState().setTool("direct-select");
      if (k === "p") editorStore.getState().setTool("pen");
      if (k === "t") editorStore.getState().setTool("type");
      if (k === "z") editorStore.getState().setTool("zoom");
      if (k === "h") editorStore.getState().setTool("hand");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} className="artboard-wrap">
      <canvas ref={canvasRef} className="artboard" />
    </div>
  );
}
