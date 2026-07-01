"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";

export function HistoryBar() {
  const controller = useEditorStore((s) => s.controller);
  const [state, setState] = useState({ undo: false, redo: false });

  useEffect(() => {
    if (!controller) return;
    const sync = () =>
      setState({ undo: controller.canUndo(), redo: controller.canRedo() });
    sync();
    return controller.onChange(sync);
  }, [controller]);

  const c = () => editorStore.getState().controller;

  return (
    <div className="panel">
      <div className="pf-grid">
        <button className="pf-btn" disabled={!state.undo} onClick={() => c()?.undo()} title="Undo (⌘Z)">
          ↶ Undo
        </button>
        <button className="pf-btn" disabled={!state.redo} onClick={() => c()?.redo()} title="Redo (⌘⇧Z)">
          ↷ Redo
        </button>
      </div>
    </div>
  );
}
