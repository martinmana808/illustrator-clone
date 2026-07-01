"use client";

import { useEffect, useState } from "react";
import { editorStore, useEditorStore } from "@/state/store";
import type { LayerInfo } from "@/engine/layers";

export function LayersPanel() {
  const controller = useEditorStore((s) => s.controller);
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    if (!controller) return;
    const sync = () => setLayers(controller.layers());
    sync();
    return controller.onChange(sync);
  }, [controller]);

  const c = () => editorStore.getState().controller;

  return (
    <div className="panel">
      <div className="panel-title">
        Layers
        <button className="mini" onClick={() => c()?.addLayer()} title="Add layer">
          +
        </button>
      </div>
      <ul className="layer-list">
        {layers.map((l) => (
          <li key={l.id} className="layer-row">
            <button className="mini" title="visibility" onClick={() => c()?.toggleLayerVisible(l.id)}>
              {l.visible ? "👁" : "—"}
            </button>
            <button className="mini" title="lock" onClick={() => c()?.toggleLayerLocked(l.id)}>
              {l.locked ? "🔒" : "🔓"}
            </button>
            <input
              className="layer-name"
              value={l.name}
              onChange={(e) => c()?.renameLayer(l.id, e.target.value)}
            />
            <button className="mini" title="move up" onClick={() => c()?.moveLayer(l.id, 1)}>
              ▲
            </button>
            <button className="mini" title="move down" onClick={() => c()?.moveLayer(l.id, -1)}>
              ▼
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
