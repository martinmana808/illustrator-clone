import paper from "paper";

export interface EditorDoc {
  scope: paper.PaperScope;
  project: paper.Project;
}

/**
 * Create an isolated editor document. Each document gets its own PaperScope so
 * multiple documents (and parallel tests) never share global state.
 */
export function createDocument(width: number, height: number): EditorDoc {
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(width, height));
  // setup() creates one default layer; ensure it exists.
  if (scope.project.layers.length === 0) {
    new scope.Layer();
  }
  return { scope, project: scope.project };
}

/** Add an axis-aligned rectangle path to the active layer. */
export function addRectangle(
  doc: EditorDoc,
  x: number,
  y: number,
  w: number,
  h: number
): paper.Path {
  doc.scope.activate();
  return new doc.scope.Path.Rectangle({
    point: [x, y],
    size: [w, h],
  }) as paper.Path;
}

/** Number of items on the active layer. */
export function activeLayerItemCount(doc: EditorDoc): number {
  return doc.project.activeLayer.children.length;
}

/** Serialize the whole project to an SVG string. */
export function toSVG(doc: EditorDoc): string {
  return doc.project.exportSVG({ asString: true }) as string;
}
