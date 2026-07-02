import { describe, it, expect } from "vitest";
import { PEN_CURSORS, cursorCss } from "../penCursors";
import type { PenCursor } from "../types";

const STATES: PenCursor[] = ["pen", "add", "delete", "close", "corner", "continue"];

describe("pen cursors", () => {
  it("defines a cursor for every PenCursor state", () => {
    for (const s of STATES) {
      expect(PEN_CURSORS[s]).toBeTruthy();
      expect(PEN_CURSORS[s].url).toContain("data:image/svg+xml");
      expect(PEN_CURSORS[s].hotspot.length).toBe(2);
    }
  });

  it("cursorCss produces a CSS cursor value with hotspot + fallback", () => {
    const css = cursorCss("add");
    expect(css).toMatch(/^url\("data:image\/svg\+xml/);
    expect(css).toMatch(/\d+ \d+, (crosshair|auto)$/);
  });
});
