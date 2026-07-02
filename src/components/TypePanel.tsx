"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";
import { ALL_FONTS, ensureFont } from "@/data/fonts";

type TextInfo = { content: string; fontSize: number; fontFamily: string };

export function TypePanel() {
  const tool = useEditorStore((s) => s.activeTool);
  const kind = useEditorStore((s) => s.selectionKind);
  const controller = useEditorStore((s) => s.controller);
  const editing = tool === "type" || tool === "type-on-path";
  const [text, setText] = useState<TextInfo | null>(null);

  useEffect(() => {
    if (!controller) return;
    const sync = () =>
      setText(editing ? controller.readText() : kind === "text" ? controller.readSelectedText() : null);
    sync();
    return controller.onChange(sync);
  }, [controller, tool, kind, editing]);

  if (!(editing || kind === "text")) return null;
  const c = () => editorStore.getState().controller;
  const applyContent = (s: string) =>
    editing ? c()?.setTextContent(s) : c()?.setSelectedTextContent(s);
  const applyFamily = async (f: string) => {
    await ensureFont(f);
    if (editing) c()?.setFontFamily(f);
    else c()?.setSelectedFontFamily(f);
  };
  const applySize = (n: number) => (editing ? c()?.setFontSize(n) : c()?.setSelectedFontSize(n));

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
            onChange={(e) => applyContent(e.target.value)}
          />
          <label className="style-row">
            <span>Font</span>
            <select value={text.fontFamily} onChange={(e) => applyFamily(e.target.value)}>
              {ALL_FONTS.map((f) => (
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
              max={200}
              step={1}
              value={text.fontSize}
              onChange={(e) => applySize(Number(e.target.value))}
            />
            <span className="mono">{text.fontSize}</span>
          </label>
        </>
      )}
    </div>
  );
}
