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
