import type { EditorDoc } from "./document";

export function exportSVGString(doc: EditorDoc): string {
  return doc.project.exportSVG({ asString: true }) as string;
}

export function exportPNGDataURL(doc: EditorDoc, scale = 1): string {
  const el = doc.scope.view.element as HTMLCanvasElement | undefined;
  if (!el || typeof el.toDataURL !== "function") return "";
  if (scale === 1) return el.toDataURL("image/png");
  const off = document.createElement("canvas");
  off.width = el.width * scale;
  off.height = el.height * scale;
  const ctx = off.getContext("2d");
  if (!ctx) return el.toDataURL("image/png");
  ctx.drawImage(el, 0, 0, off.width, off.height);
  return off.toDataURL("image/png");
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  if (typeof document === "undefined" || !dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadSVG(doc: EditorDoc, filename = "artwork.svg"): void {
  const svg = exportSVGString(doc);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  downloadDataUrl(filename, url);
}

export function downloadPNG(doc: EditorDoc, filename = "artwork.png", scale = 2): void {
  const url = exportPNGDataURL(doc, scale);
  downloadDataUrl(filename, url);
}
