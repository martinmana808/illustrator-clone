"use client";

import { useRef } from "react";
import { editorStore } from "@/state/store";

export function DocBar() {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    editorStore.getState().controller?.open(text);
    e.target.value = "";
  };

  return (
    <div className="panel">
      <div className="panel-title">Document</div>
      <div className="pf-grid">
        <button className="pf-btn" onClick={() => editorStore.getState().controller?.save()}>
          Save
        </button>
        <button className="pf-btn" onClick={() => fileRef.current?.click()}>
          Open
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={onFile}
      />
    </div>
  );
}
