"use client";

import { editorStore, useEditorStore } from "@/state/store";

const PRESETS = [0.25, 0.5, 1, 2, 4, 8];

export function ZoomStatusBar() {
  const zoom = useEditorStore((s) => s.zoom);
  const pct = Math.round(zoom * 100);
  return (
    <div className="zoombar">
      <select
        className="zoom-select"
        value="current"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "fit") editorStore.getState().controller?.fitArtboard();
          else if (v !== "current") editorStore.getState().controller?.zoomTo(Number(v));
        }}
      >
        <option value="current">{pct}%</option>
        <option value="fit">Fit</option>
        {PRESETS.map((p) => (
          <option key={p} value={p}>
            {p * 100}%
          </option>
        ))}
      </select>
    </div>
  );
}
