export interface Vec {
  x: number;
  y: number;
}

export interface Modifiers {
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
}

export type PenCursor = "pen" | "add" | "delete" | "close" | "corner" | "continue";

import type { PathfinderOp } from "@/engine/pathfinder";

/** Handle the canvas exposes to React panels for actions on live geometry. */
export interface ToolController {
  teardown: () => void;
  runPathfinder: (op: PathfinderOp) => void;
}
