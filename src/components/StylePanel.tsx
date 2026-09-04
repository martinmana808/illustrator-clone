"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";
import { STROKE_ALIGNS, type StrokeAlign } from "@/engine/strokeAlign";

const ALIGN_LABELS: Record<StrokeAlign, string> = {
  middle: "Middle",
  inside: "Inside",
  outside: "Outside",
};

export function StylePanel() {
  const count = useEditorStore((s) => s.selectionCount);
  const kind = useEditorStore((s) => s.selectionKind);
  const controller = useEditorStore((s) => s.controller);
  const [fill, setFill] = useState("#cccccc");
  const [stroke, setStroke] = useState("#000000");
  const [width, setWidth] = useState(1);
  const [align, setAlign] = useState<StrokeAlign | null>("middle");

  useEffect(() => {
    if (!controller) return;
    const sync = () => {
      const s = controller.readSelectionStyle();
      if (s.fill) setFill(s.fill);
      if (s.stroke) setStroke(s.stroke);
      if (s.strokeWidth != null) setWidth(s.strokeWidth);
      setAlign(s.strokeAlign);
    };
    sync();
    return controller.onChange(sync);
  }, [controller, count]);

  if (kind === "none") return null;
  const disabled = count < 1;
  const c = () => editorStore.getState().controller;

  return (
    <div className="panel">
      <div className="panel-title">Appearance</div>
      <label className="style-row">
        <span>Fill</span>
        <input
          type="color"
          value={fill}
          disabled={disabled}
          onChange={(e) => {
            setFill(e.target.value);
            c()?.setFill(e.target.value);
          }}
        />
        <button className="mini" disabled={disabled} onClick={() => c()?.setFill(null)}>
          none
        </button>
      </label>
      <label className="style-row">
        <span>Stroke</span>
        <input
          type="color"
          value={stroke}
          disabled={disabled}
          onChange={(e) => {
            setStroke(e.target.value);
            c()?.setStroke(e.target.value);
          }}
        />
        <button className="mini" disabled={disabled} onClick={() => c()?.setStroke(null)}>
          none
        </button>
      </label>
      <label className="style-row">
        <span>Weight</span>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={width}
          disabled={disabled}
          onChange={(e) => {
            const w = Number(e.target.value);
            setWidth(w);
            c()?.setStrokeWidth(w);
          }}
        />
        <span className="mono">{width}</span>
      </label>
      <div className="style-row">
        <span>Align</span>
        <div className="seg">
          {STROKE_ALIGNS.map((a) => (
            <button
              key={a}
              type="button"
              className={`seg-btn${align === a ? " is-on" : ""}`}
              disabled={disabled}
              onClick={() => {
                setAlign(a);
                c()?.setStrokeAlign(a);
              }}
            >
              {ALIGN_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
