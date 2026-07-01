import { describe, it, expect } from "vitest";
import { createDocument, addRectangle } from "@/engine/document";
import { exportSVGString } from "../export";

describe("export helpers", () => {
  it("exportSVGString includes drawn geometry", () => {
    const doc = createDocument(200, 200);
    addRectangle(doc, 10, 10, 50, 50);
    const svg = exportSVGString(doc);
    expect(svg).toContain("<svg");
    expect(svg.toLowerCase()).toMatch(/<path|<rect/);
  });
});
