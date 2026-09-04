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

  // All global keyboard handling lives in one listener with an explicit
  // priority order (typing > hold-space > app shortcuts > tool letters), so
  // there's a single source of truth for "what should this keystroke do"
  // instead of several independent listeners racing each other.
  useEffect(() => {
    let spacePrevTool: ToolId | null = null;

    const down = (e: KeyboardEvent) => {
      // Keystrokes belong to any focused editable element, not the canvas.
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const c = editorStore.getState().controller;
      const key = e.key;
      const k = key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;

      // 1) Clipboard & select-all. The controller dispatches internally on
      // typing state, so one block serves both text editing and object
      // selection. `!e.altKey` keeps AltGr combos (reported as ctrl+alt)
      // available for typing composed characters.
      if (mod && !e.altKey && (k === "a" || k === "c" || k === "x" || k === "v")) {
        if ((k === "c" || k === "x") && !window.getSelection()?.isCollapsed) {
          return; // the user selected DOM text (a label etc.) — let the browser copy it
        }
        e.preventDefault();
        if (k === "a") c?.selectAllInContext();
        else if (k === "c") c?.copySelection();
        else if (k === "x") c?.cutSelection();
        else c?.pasteClipboard();
        return;
      }

      // 2) Actively typing on the canvas: keystrokes go into the text.
      const t0 = editorStore.getState().activeTool;
      if ((t0 === "type" || t0 === "type-on-path") && c?.isTyping()) {
        if (key === "Escape") {
          // Commit the edit, hand the text to the Selection tool, and keep
          // it selected (matches Illustrator's Escape-out-of-typing).
          c.finishTyping();
          editorStore.getState().setTool("select");
          e.preventDefault();
          return;
        }
        // Block app chords, but let Option/AltGr character composition
        // (alt, or ctrl+alt on Windows layouts) fall through as text input.
        if (e.metaKey || (e.ctrlKey && !e.altKey)) return;
        if (key === "ArrowLeft") {
          c.caretMove(-1, e.shiftKey);
          e.preventDefault();
          return;
        }
        if (key === "ArrowRight") {
          c.caretMove(1, e.shiftKey);
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

      // 3) Hold Space → temporary Hand tool (only when not typing).
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat && spacePrevTool === null) {
          spacePrevTool = t0;
          editorStore.getState().setTool("hand");
        }
        return;
      }

      // 4) App-level shortcuts (Cmd/Ctrl combos), scoped to this tab/canvas.
      if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        c?.zoomIn();
        return;
      }
      if (mod && k === "-") {
        e.preventDefault();
        c?.zoomOut();
        return;
      }
      if (mod && k === "0") {
        e.preventDefault();
        c?.fitArtboard();
        return;
      }
      if (mod && k === "1") {
        e.preventDefault();
        c?.actualSize();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) c?.redo();
        else c?.undo();
        return;
      }
      if (mod && k === "s") {
        e.preventDefault();
        c?.save();
        return;
      }
      if (mod && k === "w") {
        // Browsers deliberately ignore preventDefault for Cmd/Ctrl-W (tab
        // close) as a security measure; this is best-effort only. The
        // beforeunload listener below covers the rest via a confirm prompt.
        e.preventDefault();
        return;
      }
      if (mod) return; // any other modified combo: don't fall through to tool letters

      // 5) Arrow keys adjust polygon sides / star points / corner radius while drawing.
      if ((key === "ArrowUp" || key === "ArrowDown") && c?.isDrawingShape()) {
        e.preventDefault();
        c.shapeArrow(key);
        return;
      }

      // 6) Tool letters.
      if (k === "c" && e.shiftKey) {
        editorStore.getState().setTool("anchor-point");
        return;
      }
      if (k === "m") editorStore.getState().setTool("rectangle");
      if (k === "l") editorStore.getState().setTool("ellipse");
      if (key === "\\") editorStore.getState().setTool("line");
      if (k === "v") editorStore.getState().setTool("select");
      if (k === "a") editorStore.getState().setTool("direct-select");
      if (k === "p") editorStore.getState().setTool("pen");
      if (k === "t") editorStore.getState().setTool("type");
      if (k === "g") editorStore.getState().setTool("gradient");
      if (k === "z") editorStore.getState().setTool("zoom");
      if (k === "h") editorStore.getState().setTool("hand");
    };

    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (spacePrevTool !== null) {
        editorStore.getState().setTool(spacePrevTool);
        spacePrevTool = null;
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Best-effort protection against losing work on accidental tab close —
  // browsers won't let JS block Cmd/Ctrl-W outright, but they will show a
  // native "leave site?" confirmation from beforeunload. Only prompt when
  // there's actually something to lose, or the warning trains users to
  // click through it.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!editorStore.getState().controller?.canUndo()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return (
    <div ref={wrapRef} className="artboard-wrap">
      <canvas ref={canvasRef} className="artboard" />
    </div>
  );
}
