"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";
import type { GradientDesc } from "@/engine/gradients";

export function GradientPanel() {
  const count = useEditorStore((s) => s.selectionCount);
  const controller = useEditorStore((s) => s.controller);
  const [grad, setGrad] = useState<GradientDesc | null>(null);

  useEffect(() => {
    if (!controller) return;
    const sync = () => setGrad(controller.readSelectionGradient());
    sync();
    return controller.onChange(sync);
  }, [controller, count]);

  if (count < 1) return null;
  const c = () => editorStore.getState().controller;
  const stops = grad?.stops ?? [];

  return (
    <div className="panel">
      <div className="panel-title">Gradient</div>
      {!grad && (
        <button className="pf-btn" onClick={() => c()?.applyDefaultGradient()}>
          Apply gradient
        </button>
      )}
      {grad && (
        <>
          <div className="pf-grid">
            <button
              className={grad.type === "linear" ? "pf-btn on" : "pf-btn"}
              onClick={() => c()?.setGradientType("linear")}
            >
              Linear
            </button>
            <button
              className={grad.type === "radial" ? "pf-btn on" : "pf-btn"}
              onClick={() => c()?.setGradientType("radial")}
            >
              Radial
            </button>
          </div>
          <div className="panel-subtitle">Stops</div>
          {stops.map((s, i) => (
            <div key={i} className="grad-stop">
              <input
                type="color"
                value={s.color}
                onChange={(e) => {
                  const next = stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x));
                  c()?.setGradientStops(next);
                }}
              />
              <span className="mono">{Math.round(s.offset * 100)}%</span>
              {stops.length > 2 && (
                <button
                  className="mini"
                  onClick={() => c()?.setGradientStops(stops.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="mini"
            onClick={() => {
              const next = [...stops, { color: "#888888", offset: 0.5 }].sort(
                (a, b) => a.offset - b.offset
              );
              c()?.setGradientStops(next);
            }}
          >
            + stop
          </button>
        </>
      )}
    </div>
  );
}
