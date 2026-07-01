"use client";

import { editorStore } from "@/state/store";

export function ExportBar() {
  return (
    <div className="panel">
      <div className="panel-title">Export</div>
      <div className="pf-grid">
        <button className="pf-btn" onClick={() => editorStore.getState().controller?.exportSVG()}>
          SVG
        </button>
        <button className="pf-btn" onClick={() => editorStore.getState().controller?.exportPNG()}>
          PNG
        </button>
      </div>
    </div>
  );
}
