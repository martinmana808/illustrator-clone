import paper from "paper";
import type { EditorDoc } from "./document";

/** Initialize a PaperScope bound to a real canvas so drawing is visible. */
export function attachToCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): EditorDoc {
  const scope = new paper.PaperScope();
  scope.setup(canvas);
  scope.view.viewSize = new scope.Size(width, height);
  if (scope.project.layers.length === 0) {
    new scope.Layer();
  }
  return { scope, project: scope.project };
}
