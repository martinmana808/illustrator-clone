import type paper from "paper";
import type { EditorDoc } from "@/engine/document";
import { PenTool } from "./pen";
import { SelectTool } from "./select";
import { DirectSelectTool } from "./directSelect";
import { AnchorPointTool } from "./anchorPoint";
import { TypeTool } from "./type";
import { TypeOnPathTool } from "./typeOnPath";
import { ZoomTool } from "./zoomTool";
import { HandTool } from "./handTool";
import { ShapeTool, SHAPE_KINDS, type ShapeKind } from "./shapeTool";
import { GradientTool } from "./gradientTool";
import {
  applyGradient,
  readGradient,
  defaultGradient,
  type GradientStop,
} from "@/engine/gradients";
import { zoomAtPoint, fitBounds, clampZoom } from "@/engine/viewport";
import { handlePoints } from "./transformBox";
import { selectionKind } from "@/engine/selection";
import { cursorCss } from "./penCursors";
import { HIT_TOLERANCE } from "./constants";
import { hitTestItem } from "./hitTest";
import type { Modifiers, Vec, ToolController } from "./types";
import { editorStore } from "@/state/store";
import { applyPathfinder, type PathfinderOp, type PItem } from "@/engine/pathfinder";
import { applyFill, applyStroke, applyStrokeWidth, readStyle } from "@/engine/style";
import { applyStrokeAlign, applyStrokeAlignVisuals } from "@/engine/strokeAlign";
import { importSVGString, importImage, hideTemplates } from "@/engine/import";
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
import { downloadDocument, loadDocument } from "@/engine/persist";
import { copyItems, pasteItems, copyText, readClipboardText } from "@/engine/clipboard";

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

// Illustrator's Direct Selection cursor is a hollow (white) arrow.
const WHITE_ARROW_CURSOR =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
      '<path d="M4 2 L4 15 L7.5 11.5 L10 17 L12 16 L9.5 10.5 L14 10.5 Z" fill="#fff" stroke="#000" stroke-width="1"/>' +
      "</svg>"
  ) +
  '") 4 2, default';

/**
 * Attach a Paper.js Tool that routes pointer/keyboard events to the active
 * tool (Pen or Select), draws the Pen rubber-band overlay, and exposes
 * `runPathfinder` so the panel can operate on the current selection.
 */
export function installTools(doc: EditorDoc): ToolController {
  const scope = doc.scope;
  scope.activate();
  scope.settings.handleSize = 0; // our overlay owns anchor/handle rendering
  const pen = new PenTool(doc);
  const select = new SelectTool(doc);
  const directSelect = new DirectSelectTool(doc);
  const anchorPoint = new AnchorPointTool(doc);
  const type = new TypeTool(doc);
  const typeOnPath = new TypeOnPathTool(doc);
  const zoomTool = new ZoomTool(doc);
  const handTool = new HandTool(doc);
  const shapeTool = new ShapeTool(doc);
  const gradientTool = new GradientTool(doc);
  const isShape = (t: string): t is ShapeKind => (SHAPE_KINDS as string[]).includes(t);
  const tool = new scope.Tool();

  // Full-screen artboard chrome, sized to the canvas at mount.
  const el0 = scope.view.element as HTMLCanvasElement;
  const artboardSize = { width: el0?.width || 900, height: el0?.height || 600 };
  function drawArtboard() {
    const board = new scope.Path.Rectangle({
      point: [0, 0],
      size: [artboardSize.width, artboardSize.height],
    });
    board.fillColor = new scope.Color(1, 1, 1);
    board.strokeColor = new scope.Color(0.8, 0.8, 0.82);
    board.strokeWidth = 1 / scope.view.zoom;
    board.data.isChrome = true;
    // The board is opaque, so it has to sit behind *every* layer — not just at
    // the back of the drawing layer, or it would paint over a template image
    // on the layer below. It gets its own throwaway layer at the very bottom,
    // which stripOverlays() removes along with the rest of the chrome.
    const drawingLayer = scope.project.activeLayer;
    const boardLayer = new scope.Layer();
    boardLayer.data.isChrome = true;
    boardLayer.addChild(board);
    boardLayer.sendToBack();
    drawingLayer?.activate();
    overlays.push(boardLayer);
  }

  // UI overlays (pen rubber-band, selection box + handles). These live in the
  // project so they render, but must NEVER be serialized — stripOverlays() is
  // called before every history capture / export, then overlays are redrawn.
  let overlays: paper.Item[] = [];

  const active = () => editorStore.getState().activeTool;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((cb) => cb());
  const sel = () => select.selection;
  const history = new History(doc);

  // Inside/outside strokes are drawn as clipped groups that must never reach
  // the document — restoring is part of stripping, so history/save/export
  // (which all strip first) only ever see the real paths.
  let restoreStrokeAlign: (() => void) | null = null;

  function stripOverlays() {
    if (restoreStrokeAlign) {
      restoreStrokeAlign();
      restoreStrokeAlign = null;
    }
    overlays.forEach((o) => o.remove());
    overlays = [];
  }

  let caretVisible = true;

  function textMeasure(t: paper.PointText): (s: string) => number {
    const el = scope.view.element as HTMLCanvasElement | undefined;
    const ctx = el?.getContext?.("2d");
    if (!ctx) return () => 0;
    ctx.font = `${t.fontSize as number}px ${t.fontFamily}`;
    return (s: string) => ctx.measureText(s).width;
  }

  function drawTextCaret() {
    const t = type.editing;
    if (!t || !caretVisible || type.hasSelection) return;
    const upto = t.content.slice(0, type.caret);
    const nl = upto.lastIndexOf("\n");
    const lineText = nl >= 0 ? upto.slice(nl + 1) : upto;
    const lineIndex = (upto.match(/\n/g) || []).length;
    const fontSize = t.fontSize as number;
    const w = textMeasure(t)(lineText);
    const lineHeight = (t.leading as number) || fontSize * 1.2;
    const x = t.point.x + w;
    const baseY = t.point.y + lineIndex * lineHeight;
    const caret = new scope.Path.Line(
      new scope.Point(x, baseY - fontSize),
      new scope.Point(x, baseY + fontSize * 0.25)
    );
    caret.strokeColor = new scope.Color(0, 0, 0);
    caret.strokeWidth = 1;
    overlays.push(caret);
  }

  /** Translucent highlight rectangles behind the selected text range, per line. */
  function drawTextSelection() {
    const t = type.editing;
    const range = type.selectionRange;
    if (!t || !range) return;
    const fontSize = t.fontSize as number;
    const lineHeight = (t.leading as number) || fontSize * 1.2;
    const measure = textMeasure(t);
    const lines = t.content.split("\n");
    let idx = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineStart = idx;
      const lineEnd = idx + line.length;
      idx = lineEnd + 1; // account for the newline
      const start = Math.max(range.start, lineStart);
      const end = Math.min(range.end, lineEnd);
      if (start >= end) continue;
      const xStart = t.point.x + measure(line.slice(0, start - lineStart));
      const width = measure(line.slice(start - lineStart, end - lineStart));
      const y = t.point.y + li * lineHeight;
      const rect = new scope.Path.Rectangle({
        point: [xStart, y - fontSize],
        size: [width, fontSize * 1.25],
      });
      rect.fillColor = new scope.Color(0.15, 0.5, 0.9, 0.35);
      rect.insertBelow(t);
      overlays.push(rect);
    }
  }

  // Illustrator-style anchors/handles for point-editing tools.
  function drawAnchorOverlay() {
    const blue = new scope.Color(0.15, 0.5, 0.9);
    for (const item of scope.project.activeLayer.children) {
      const path = item as paper.Path;
      if (!path.segments) continue;
      if (!(path.selected || path.segments.some((s) => s.selected))) continue;
      for (const seg of path.segments) {
        if (seg.selected) {
          for (const h of [seg.handleIn, seg.handleOut]) {
            if (h.length < 0.01) continue;
            const end = seg.point.add(h);
            const line = new scope.Path.Line(seg.point, end);
            line.strokeColor = blue;
            line.strokeWidth = 1;
            overlays.push(line);
            const dot = new scope.Path.Circle(end, 2.5);
            dot.fillColor = blue;
            overlays.push(dot);
          }
        }
        const sq = new scope.Path.Rectangle({
          point: [seg.point.x - 3, seg.point.y - 3],
          size: [6, 6],
        });
        if (seg.selected) {
          sq.fillColor = blue;
        } else {
          sq.fillColor = new scope.Color(1, 1, 1);
          sq.strokeColor = blue;
          sq.strokeWidth = 1;
        }
        overlays.push(sq);
      }
    }
  }

  const syncZoom = () => editorStore.getState().setZoom(scope.view.zoom);

  function drawOverlays() {
    stripOverlays();
    drawArtboard();
    restoreStrokeAlign = applyStrokeAlignVisuals(doc);
    if (active() === "type") {
      if (type.isEditing) {
        drawTextSelection();
        drawTextCaret();
      }
      scope.view.update();
      return;
    }
    if (active() === "direct-select" || active() === "anchor-point") {
      drawAnchorOverlay();
      scope.view.update();
      return;
    }
    if (active() === "pen") {
      const p = pen.previewPoint;
      const path = pen.currentPath;
      if (p && path && path.lastSegment) {
        // Curved preview: bend using the last anchor's outgoing handle.
        const last = path.lastSegment;
        const seg0 = new scope.Segment(last.point, last.handleIn, last.handleOut);
        const seg1 = new scope.Segment(new scope.Point(p.x, p.y));
        const preview = new scope.Path([seg0, seg1]);
        preview.strokeColor = new scope.Color(0.4, 0.4, 0.9);
        preview.dashArray = [4, 4];
        overlays.push(preview);
      }
    } else if (active() === "select") {
      const b = select.selectionBounds();
      if (b) {
        const box = new scope.Path.Rectangle({ point: [b.x, b.y], size: [b.width, b.height] });
        box.strokeColor = new scope.Color(0.2, 0.5, 1);
        box.strokeWidth = 1;
        box.dashArray = [4, 3];
        overlays.push(box);
        for (const h of handlePoints(b)) {
          const s = new scope.Path.Rectangle({ point: [h.x - 3, h.y - 3], size: [6, 6] });
          s.fillColor = new scope.Color(1, 1, 1);
          s.strokeColor = new scope.Color(0.2, 0.5, 1);
          s.strokeWidth = 1;
          overlays.push(s);
        }
      }
    }
    scope.view.update();
  }

  /** Run a serialization-sensitive action with overlays stripped, then redraw. */
  function withoutOverlays<T>(fn: () => T): T {
    stripOverlays();
    const r = fn();
    drawOverlays();
    return r;
  }

  const commit = () => {
    stripOverlays();
    history.capture();
    emit();
    drawOverlays();
  };
  const syncSelection = () => {
    editorStore.getState().setSelectionCount(select.selection.length);
    editorStore.getState().setSelectionKind(selectionKind(select.selection));
    emit();
  };
  const firstSelectedText = (): paper.PointText | null => {
    const t = select.selection.find((it) => it.className === "PointText");
    return (t as paper.PointText) ?? null;
  };
  // Type-on-path has no selection/insert API yet, so clipboard-ish actions
  // are no-ops while it's mid-edit.
  const typingOnPath = () => active() === "type-on-path" && typeOnPath.isEditing;
  // Commit an in-progress Type edit and keep the text object selected, so
  // exiting text mode hands the item to the Selection tool (like Illustrator).
  const commitTextEdit = () => {
    const kept = type.finish();
    if (kept) {
      doc.project.deselectAll();
      kept.selected = true;
    }
    scope.view.update();
    syncSelection();
    commit();
  };
  const copySelection = () => {
    if (typingOnPath()) return;
    if (type.isEditing) {
      const text = type.selectedText;
      if (text) copyText(text);
    } else if (sel().length > 0) {
      copyItems(sel());
    }
  };

  tool.onMouseDown = (e: paper.ToolEvent) => {
    stripOverlays(); // hit-test only real content
    if (active() === "pen") {
      pen.pointerDown(vec(e.point), mods(e));
    } else if (active() === "select") {
      select.pointerDown(vec(e.point), mods(e));
      syncSelection();
    } else if (active() === "direct-select") {
      directSelect.pointerDown(vec(e.point), mods(e));
    } else if (active() === "anchor-point") {
      anchorPoint.pointerDown(vec(e.point), mods(e));
    } else if (active() === "type") {
      type.pointerDown(vec(e.point), mods(e));
      emit();
    } else if (active() === "type-on-path") {
      typeOnPath.pointerDown(vec(e.point), mods(e));
      commit();
    } else if (active() === "zoom") {
      zoomTool.pointerDown(vec(e.point), mods(e));
    } else if (active() === "hand") {
      handTool.pointerDown(vec(e.point));
    } else if (isShape(active())) {
      shapeTool.setKind(active() as ShapeKind);
      shapeTool.pointerDown(vec(e.point), mods(e));
    } else if (active() === "gradient") {
      gradientTool.pointerDown(vec(e.point), mods(e));
    }
    drawOverlays();
  };
  tool.onMouseDrag = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "select") {
      select.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "direct-select") {
      directSelect.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "anchor-point") {
      anchorPoint.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "zoom") {
      zoomTool.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "hand") {
      handTool.pointerDrag(vec(e.point));
    } else if (isShape(active())) {
      shapeTool.pointerDrag(vec(e.point), mods(e));
    } else if (active() === "gradient") {
      gradientTool.pointerDrag(vec(e.point), mods(e));
    }
    drawOverlays();
  };
  tool.onMouseUp = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerUp(vec(e.point), mods(e));
      commit();
    } else if (active() === "select") {
      select.pointerUp(vec(e.point), mods(e));
      syncSelection();
      commit();
    } else if (active() === "direct-select") {
      directSelect.pointerUp(vec(e.point), mods(e));
      commit();
    } else if (active() === "anchor-point") {
      anchorPoint.pointerUp(vec(e.point), mods(e));
      commit();
    } else if (active() === "zoom") {
      zoomTool.pointerUp(vec(e.point), mods(e));
      syncZoom();
    } else if (active() === "hand") {
      handTool.pointerUp(vec(e.point));
    } else if (isShape(active())) {
      shapeTool.pointerUp(vec(e.point), mods(e));
      commit();
    } else if (active() === "gradient") {
      gradientTool.pointerUp(vec(e.point), mods(e));
      commit();
    }
    drawOverlays();
  };
  tool.onMouseMove = (e: paper.ToolEvent) => {
    if (active() === "pen") {
      pen.pointerMove(vec(e.point), mods(e));
      drawOverlays();
      const el = scope.view.element as HTMLCanvasElement | undefined;
      if (el) el.style.cursor = cursorCss(pen.hoverCursor(vec(e.point), mods(e)));
    }
  };
  tool.onKeyDown = (e: paper.KeyEvent) => {
    if (active() === "pen" && (e.key === "enter" || e.key === "escape")) {
      pen.finish();
      drawOverlays();
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
    stripOverlays();
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
    editorStore.getState().setSelectionCount(select.selection.length);
    emit();
    drawOverlays();
  };

  // --- Navigation ---
  const viewState = () => ({
    zoom: scope.view.zoom,
    center: { x: scope.view.center.x, y: scope.view.center.y },
  });
  const applyView = (s: { zoom: number; center: { x: number; y: number } }) => {
    scope.view.zoom = s.zoom;
    scope.view.center = new scope.Point(s.center.x, s.center.y);
    syncZoom();
    drawOverlays();
  };
  const artboardCenter = () => ({ x: artboardSize.width / 2, y: artboardSize.height / 2 });

  // Redraw overlays when the active tool changes (e.g. show/hide the box).
  let lastTool = active();
  const unsubTool = editorStore.subscribe(() => {
    const t = editorStore.getState().activeTool;
    if (t !== lastTool) {
      // Leaving a text tool (toolbar click, shortcut, dblclick handoff) commits
      // any in-progress edit — otherwise isEditing stays stale and clipboard /
      // select-all keep routing to an abandoned text object.
      if (lastTool === "type" && type.isEditing) {
        commitTextEdit();
      } else if (lastTool === "type-on-path" && typeOnPath.isEditing) {
        typeOnPath.finish();
        commit();
      }
      lastTool = t;
      drawOverlays();
      const el = scope.view.element as HTMLCanvasElement | undefined;
      if (el) {
        if (t === "pen") el.style.cursor = cursorCss("pen");
        else if (t === "direct-select") el.style.cursor = WHITE_ARROW_CURSOR;
        else el.style.cursor = "default";
      }
    }
  });

  // Blink the text caret while editing. While a range is selected the caret
  // is hidden anyway, so skip the redraw — every tick would repaint identical
  // pixels (highlight rects, measurements) for nothing.
  const blink = setInterval(() => {
    if (active() === "type" && type.isEditing && !type.hasSelection) {
      caretVisible = !caretVisible;
      drawOverlays();
    }
  }, 530);

  // Double-click a path with the Selection tool → drop into Direct Select.
  const canvasEl = scope.view.element as HTMLCanvasElement | undefined;
  const onDblClick = (ev: MouseEvent) => {
    if (active() !== "select" || !canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const pt = new scope.Point(ev.clientX - rect.left, ev.clientY - rect.top);
    stripOverlays(); // don't hit-test the artboard chrome / overlays
    const hitItem = hitTestItem(doc, pt, HIT_TOLERANCE, { fill: true, stroke: true });
    if (hitItem) {
      scope.project.deselectAll();
      if (hitItem.className === "PointText") {
        // Double-click text → jump straight into text editing.
        type.editItem(hitItem as paper.PointText);
        editorStore.getState().setTool("type");
        drawOverlays();
      } else {
        (hitItem as paper.Path).fullySelected = true;
        editorStore.getState().setTool("direct-select");
        editorStore.getState().setSelectionCount(1);
        drawOverlays();
      }
    } else {
      drawOverlays(); // nothing hit — restore the chrome/overlays
    }
  };
  canvasEl?.addEventListener("dblclick", onDblClick);

  tool.activate();
  return {
    teardown: () => {
      unsubTool();
      clearInterval(blink);
      canvasEl?.removeEventListener("dblclick", onDblClick);
      stripOverlays();
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
    setStrokeAlign: (a) => {
      applyStrokeAlign(sel(), a);
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
    exportSVG: () =>
      withoutOverlays(() => {
        // Overlays are stripped, so re-apply the aligned strokes just for the
        // export — they serialize to real <clipPath> elements.
        const showTemplates = hideTemplates(doc);
        const restore = applyStrokeAlignVisuals(doc);
        downloadSVG(doc);
        restore();
        showTemplates();
      }),
    exportPNG: () =>
      withoutOverlays(() => {
        const showTemplates = hideTemplates(doc);
        const view = scope.view;
        const sZoom = view.zoom;
        const sCenter = view.center;
        const sSize = view.viewSize;
        view.viewSize = new scope.Size(artboardSize.width, artboardSize.height);
        view.zoom = 1;
        view.center = new scope.Point(artboardSize.width / 2, artboardSize.height / 2);
        view.update();
        downloadPNG(doc);
        view.viewSize = sSize;
        view.zoom = sZoom;
        view.center = sCenter;
        showTemplates();
        view.update();
      }),
    save: () => withoutOverlays(() => downloadDocument(doc)),
    open: (json) => {
      loadDocument(doc, json);
      history.capture();
      afterRestore();
    },
    placeSVG: (svg) => {
      withoutOverlays(() => importSVGString(doc, svg, artboardSize));
      syncSelection();
      commit();
    },
    placeImage: async (dataUrl) => {
      // commit() strips the chrome before capturing, so there is no need to
      // clear it up front — doing so would flash the artboard away while a
      // large image decodes.
      await importImage(doc, dataUrl, artboardSize);
      commit();
    },
    typeKey: (key) => {
      if (active() === "type-on-path") typeOnPath.keyInput(key);
      else type.keyInput(key);
      caretVisible = true;
      drawOverlays();
      emit();
    },
    caretMove: (dir, extend = false) => {
      type.moveCaret(dir, extend);
      caretVisible = true;
      drawOverlays();
    },
    setTextContent: (s) => {
      type.setContent(s);
      caretVisible = true;
      drawOverlays();
      emit();
    },
    finishTyping: () => {
      if (active() === "type-on-path") {
        typeOnPath.finish();
        scope.view.update();
        commit();
      } else {
        commitTextEdit();
      }
    },
    isTyping: () => (active() === "type-on-path" ? typeOnPath.isEditing : type.isEditing),
    hasTextSelection: () => type.hasSelection,
    selectAllInContext: () => {
      if (typingOnPath()) return; // type-on-path has no selection model yet
      if (type.isEditing) {
        type.selectAll();
        caretVisible = true;
        drawOverlays();
      } else {
        stripOverlays(); // only real content should end up selected
        select.selectAll();
        syncSelection();
        drawOverlays();
      }
    },
    copySelection,
    cutSelection: () => {
      if (typingOnPath()) return;
      if (type.isEditing) {
        if (!type.hasSelection) return;
        copySelection();
        type.deleteSelection();
        caretVisible = true;
        drawOverlays();
        emit();
      } else if (sel().length > 0) {
        copySelection();
        select.deleteSelection();
        scope.view.update();
        syncSelection();
        commit();
      }
    },
    pasteClipboard: () => {
      if (typingOnPath()) return;
      if (type.isEditing) {
        readClipboardText().then((text) => {
          if (!text) return;
          type.insertText(text);
          caretVisible = true;
          drawOverlays();
          emit();
        });
      } else {
        const pasted = pasteItems(doc);
        if (pasted.length > 0) {
          syncSelection();
          scope.view.update();
          commit();
        }
      }
    },
    setFontSize: (n) => {
      type.setFontSize(n);
      drawOverlays();
      emit();
    },
    setFontFamily: (f) => {
      type.setFontFamily(f);
      drawOverlays();
      emit();
    },
    readText: () => {
      const t = type.editing;
      if (!t) return null;
      return { content: t.content, fontSize: t.fontSize as number, fontFamily: t.fontFamily as string };
    },
    readSelectedText: () => {
      const t = firstSelectedText();
      if (!t) return null;
      return { content: t.content, fontSize: t.fontSize as number, fontFamily: t.fontFamily as string };
    },
    setSelectedTextContent: (s) => {
      const t = firstSelectedText();
      if (t) t.content = s;
      scope.view.update();
      commit();
    },
    setSelectedFontSize: (n) => {
      const t = firstSelectedText();
      if (t) t.fontSize = n;
      scope.view.update();
      commit();
    },
    setSelectedFontFamily: (f) => {
      const t = firstSelectedText();
      if (t) t.fontFamily = f;
      scope.view.update();
      commit();
    },
    undo: () => {
      if (history.undo()) afterRestore();
    },
    redo: () => {
      if (history.redo()) afterRestore();
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    zoomIn: () => applyView(zoomAtPoint(viewState(), 1.25, viewState().center)),
    zoomOut: () => applyView(zoomAtPoint(viewState(), 0.8, viewState().center)),
    zoomTo: (z) => applyView({ zoom: clampZoom(z), center: viewState().center }),
    fitArtboard: () =>
      applyView(
        fitBounds(
          { width: scope.view.viewSize.width, height: scope.view.viewSize.height },
          { x: 0, y: 0, width: artboardSize.width, height: artboardSize.height }
        )
      ),
    actualSize: () => applyView({ zoom: 1, center: artboardCenter() }),
    zoomAtClient: (clientX, clientY, factor) => {
      const rect = (scope.view.element as HTMLCanvasElement).getBoundingClientRect();
      const proj = scope.view.viewToProject(
        new scope.Point(clientX - rect.left, clientY - rect.top)
      );
      applyView(zoomAtPoint(viewState(), factor, { x: proj.x, y: proj.y }));
    },
    panBy: (dx, dy) => {
      scope.view.center = scope.view.center.add(
        new scope.Point(dx / scope.view.zoom, dy / scope.view.zoom)
      );
      drawOverlays();
    },
    getZoom: () => scope.view.zoom,
    shapeArrow: (key) => {
      shapeTool.keyInput(key);
      scope.view.update();
    },
    isDrawingShape: () => shapeTool.drawing,
    readSelectionGradient: () => {
      const first = select.selection[0];
      return first ? readGradient(first) : null;
    },
    setGradientType: (type) => {
      for (const it of select.selection) {
        const base = readGradient(it) ?? defaultGradient(it);
        applyGradient([it], { ...base, type });
      }
      scope.view.update();
      commit();
    },
    setGradientStops: (stops: GradientStop[]) => {
      for (const it of select.selection) {
        const base = readGradient(it) ?? defaultGradient(it);
        applyGradient([it], { ...base, stops });
      }
      scope.view.update();
      commit();
    },
    applyDefaultGradient: () => {
      for (const it of select.selection) {
        applyGradient([it], defaultGradient(it));
      }
      scope.view.update();
      commit();
    },
    onChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

