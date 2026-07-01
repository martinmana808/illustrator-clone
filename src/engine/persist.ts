import type { EditorDoc } from "./document";
import { downloadDataUrl } from "./export";

/** Serialize the whole document (all layers/items/styles) to a JSON string. */
export function serializeDocument(doc: EditorDoc): string {
  return doc.project.exportJSON();
}

/** Replace the document's content with a previously serialized JSON string. */
export function loadDocument(doc: EditorDoc, json: string): void {
  doc.project.clear();
  doc.project.importJSON(json);
  if (doc.project.layers.length === 0) {
    doc.scope.activate();
    new doc.scope.Layer();
  }
  // Open documents deselected (matches Illustrator) — avoids a stale selection.
  doc.project.deselectAll();
  doc.scope.view?.update?.();
}

/** Download the document as an .iclone.json file (browser only). */
export function downloadDocument(doc: EditorDoc, filename = "artwork.iclone.json"): void {
  const json = serializeDocument(doc);
  const url = "data:application/json;charset=utf-8," + encodeURIComponent(json);
  downloadDataUrl(filename, url);
}
