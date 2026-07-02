"use client";

import { useEditorStore } from "@/state/store";
import type { ToolId } from "@/state/store";

const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "direct-select", label: "Direct Select", key: "A" },
  { id: "anchor-point", label: "Anchor Point", key: "Shift+C" },
  { id: "pen", label: "Pen", key: "P" },
  { id: "type", label: "Type", key: "T" },
  { id: "type-on-path", label: "Type on Path", key: "" },
  { id: "hand", label: "Hand", key: "H" },
  { id: "zoom", label: "Zoom", key: "Z" },
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
          title={t.key ? `${t.label} (${t.key})` : t.label}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
