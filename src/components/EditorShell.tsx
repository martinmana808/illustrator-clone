"use client";

import dynamic from "next/dynamic";
import { Toolbar } from "./Toolbar";
import { StylePanel } from "./StylePanel";
import { LayersPanel } from "./LayersPanel";
import { PathfinderPanel } from "./PathfinderPanel";
import { ExportBar } from "./ExportBar";

// Paper.js only works in the browser (it needs a real <canvas>). Loading it on
// the server makes it pull in jsdom and fail. Disabling SSR for the artboard
// keeps `paper` out of the server bundle entirely.
const ArtboardCanvas = dynamic(
  () => import("./ArtboardCanvas").then((m) => m.ArtboardCanvas),
  { ssr: false, loading: () => <div className="artboard-loading">Loading…</div> }
);

export function EditorShell() {
  return (
    <main className="editor">
      <Toolbar />
      <div className="stage">
        <ArtboardCanvas />
      </div>
      <div className="rail">
        <StylePanel />
        <LayersPanel />
        <PathfinderPanel />
        <ExportBar />
      </div>
    </main>
  );
}
