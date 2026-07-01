"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";

const FONTS = ["sans-serif", "serif", "monospace", "cursive"];

export function TypePanel() {
  const tool = useEditorStore((s) => s.activeTool);
  const controller = useEditorStore((s) => s.controller);
  const [text, setText] = useState<{
    content: string;
    fontSize: number;
    fontFamily: string;
  } | null>(null);

  useEffect(() => {
    if (!controller) return;
    const sync = () => setText(controller.readText());
    sync();
    return controller.onChange(sync);
  }, [controller, tool]);

  if (tool !== "type") return null;

  const c = () => editorStore.getState().controller;

  return (
    <div className="panel">
      <div className="panel-title">Type</div>
      {!text && <div className="panel-hint">Click the canvas to add text, then type.</div>}
      {text && (
        <>
          <textarea
            className="type-content"
            rows={2}
            value={text.content}
            placeholder="Type here…"
            onChange={(e) => c()?.setTextContent(e.target.value)}
          />
          <label className="style-row">
            <span>Font</span>
            <select
              value={text.fontFamily}
              onChange={(e) => c()?.setFontFamily(e.target.value)}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span />
          </label>
          <label className="style-row">
            <span>Size</span>
            <input
              type="range"
              min={8}
              max={120}
              step={1}
              value={text.fontSize}
              onChange={(e) => c()?.setFontSize(Number(e.target.value))}
            />
            <span className="mono">{text.fontSize}</span>
          </label>
        </>
      )}
    </div>
  );
}
