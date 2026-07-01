"use client";

import { editorStore, useEditorStore } from "@/state/store";
import { PATHFINDER_OPS } from "@/engine/pathfinder";

const SHAPE_MODES = ["unite", "minusFront", "intersect", "exclude"];

export function PathfinderPanel() {
  const count = useEditorStore((s) => s.selectionCount);
  const shapeModes = PATHFINDER_OPS.filter((o) => SHAPE_MODES.includes(o.id));
  const pathfinders = PATHFINDER_OPS.filter((o) => !SHAPE_MODES.includes(o.id));

  const run = (id: (typeof PATHFINDER_OPS)[number]["id"]) =>
    editorStore.getState().controller?.runPathfinder(id);

  return (
    <div className="panel">
      <div className="panel-title">Pathfinder</div>
      <div className="panel-hint">{count} selected</div>
      <div className="panel-subtitle">Shape Modes</div>
      <div className="pf-grid">
        {shapeModes.map((op) => (
          <button
            key={op.id}
            className="pf-btn"
            disabled={count < 1}
            onClick={() => run(op.id)}
            title={op.label}
          >
            {op.label}
          </button>
        ))}
      </div>
      <div className="panel-subtitle">Pathfinders</div>
      <div className="pf-grid">
        {pathfinders.map((op) => (
          <button
            key={op.id}
            className="pf-btn"
            disabled={count < 1}
            onClick={() => run(op.id)}
            title={op.label}
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}
