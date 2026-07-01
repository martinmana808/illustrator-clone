"use client";

import { useEffect, useRef } from "react";
import { attachToCanvas } from "@/engine/browser";
import { addRectangle } from "@/engine/document";

const W = 900;
const H = 600;

export function ArtboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const doc = attachToCanvas(canvas, W, H);
    // Demo content to prove rendering works; removed once tools land.
    const rect = addRectangle(doc, 60, 60, 200, 140);
    rect.fillColor = new doc.scope.Color(0.85, 0.9, 1);
    rect.strokeColor = new doc.scope.Color(0.1, 0.2, 0.4);
    rect.strokeWidth = 2;
    doc.scope.view.update();
    return () => {
      doc.scope.project.clear();
      doc.scope.view.remove();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="artboard"
      // Paper.js manages the pixel ratio; fixed CSS size keeps 1:1 for now.
      style={{ width: W, height: H }}
    />
  );
}
