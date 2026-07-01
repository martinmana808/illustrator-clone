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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const c = editorStore.getState().controller;
      const key = e.key;
      const k = key.toLowerCase();

      // While actively typing, keystrokes go into the text object.
      if (editorStore.getState().activeTool === "type" && c?.isTyping()) {
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

      // Undo / redo (⌘Z / ⌘⇧Z or Ctrl variants).
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) c?.redo();
        else c?.undo();
        return;
      }
      // Don't hijack other ⌘/Ctrl combos as tool switches.
      if (e.metaKey || e.ctrlKey) return;
      if (k === "v") editorStore.getState().setTool("select");
      if (k === "a") editorStore.getState().setTool("direct-select");
      if (k === "p") editorStore.getState().setTool("pen");
      if (k === "t") editorStore.getState().setTool("type");
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
