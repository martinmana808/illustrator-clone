import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import { hitTestItem } from "../hitTest";

describe("hitTestItem", () => {
  it("falls back to a PointText's own bounds when fill/stroke hit-testing misses", () => {
    const doc = createDocument(300, 300);
    doc.scope.activate();
    const t = new doc.scope.PointText({
      point: [20, 50],
      content: "Hi",
      fontSize: 24,
      fontFamily: "sans-serif",
    });
    t.fillColor = new doc.scope.Color(0, 0, 0);

    // A point inside the text's logical bounds that (in jsdom, with no real
    // font metrics) a literal fill hit-test won't match.
    const pt = new doc.scope.Point(t.bounds.center.x, t.bounds.center.y);
    const hit = hitTestItem(doc, pt, 6);
    expect(hit).toBe(t);
  });

  it("returns null when nothing is near the point", () => {
    const doc = createDocument(300, 300);
    doc.scope.activate();
    new doc.scope.PointText({
      point: [20, 50],
      content: "Hi",
      fontSize: 24,
      fontFamily: "sans-serif",
    });
    const hit = hitTestItem(doc, new doc.scope.Point(280, 280), 6);
    expect(hit).toBeNull();
  });
});
