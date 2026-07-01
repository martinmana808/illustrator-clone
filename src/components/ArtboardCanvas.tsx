"use client";

import { useEffect, useRef } from "react";
import { attachToCanvas } from "@/engine/browser";
import { installTools } from "@/tools/useActiveTool";
import { editorStore } from "@/state/store";

const W = 900;
const H = 600;

export function ArtboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const doc = attachToCanvas(canvas, W, H);
    const controller = installTools(doc);
    editorStore.getState().setController(controller);
    doc.scope.view.update();
    return () => {
      controller.teardown();
      editorStore.getState().setController(null);
      doc.scope.project.clear();
      doc.scope.view.remove();
    };
  }, []);

  // Keyboard tool shortcuts (V / A / P), matching Illustrator.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      // Undo / redo (⌘Z / ⌘⇧Z or Ctrl variants).
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        const c = editorStore.getState().controller;
        if (e.shiftKey) c?.redo();
        else c?.undo();
        return;
      }
      // Don't hijack other ⌘/Ctrl combos as tool switches.
      if (e.metaKey || e.ctrlKey) return;
      if (k === "v") editorStore.getState().setTool("select");
      if (k === "a") editorStore.getState().setTool("direct-select");
      if (k === "p") editorStore.getState().setTool("pen");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="artboard"
      style={{ width: W, height: H }}
    />
  );
}
