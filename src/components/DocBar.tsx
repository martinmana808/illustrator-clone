"use client";

import { useRef } from "react";
import { editorStore } from "@/state/store";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function DocBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    editorStore.getState().controller?.open(text);
    e.target.value = "";
  };

  // SVG comes in as editable paths; a bitmap goes onto the locked, dimmed
  // Template layer to trace over with the Pen tool.
  const onPlace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const controller = editorStore.getState().controller;
    if (!controller) return;
    const isSVG = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (isSVG) controller.placeSVG(await file.text());
    else await controller.placeImage(await readAsDataURL(file));
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
        <button className="pf-btn wide" onClick={() => placeRef.current?.click()}>
          Place…
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <input
        ref={placeRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
        style={{ display: "none" }}
        onChange={onPlace}
      />
    </div>
  );
}
