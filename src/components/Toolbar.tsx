"use client";

import { useEditorStore } from "@/state/store";
import type { ToolId } from "@/state/store";

const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "direct-select", label: "Direct Select", key: "A" },
  { id: "pen", label: "Pen", key: "P" },
];

export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? "tool active" : "tool"}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
