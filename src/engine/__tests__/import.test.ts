import { describe, it, expect } from "vitest";
import { createDocument } from "../document";
import { importSVGString, templateLayer, hideTemplates, TEMPLATE_LAYER } from "../import";

const ARTBOARD = { width: 400, height: 400 };

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
  <g transform="translate(10,10)">
    <rect x="0" y="0" width="20" height="20" fill="red"/>
    <circle cx="30" cy="30" r="8" fill="blue"/>
  </g>
</svg>`;

describe("import", () => {
  it("flattens an SVG into editable paths on the active layer", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const items = importSVGString(d, SVG, ARTBOARD);

    expect(items).toHaveLength(2);
    // Direct children of the layer, not nested in the SVG's <g>, so Select /
    // Direct Select / Pathfinder all reach them.
    for (const it of items) {
      expect(it.parent).toBe(d.project.activeLayer);
      expect(it.className).toBe("Path");
    }
    expect(d.project.activeLayer.children).toHaveLength(2);
  });

  it("keeps the group transform baked into the flattened geometry", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const items = importSVGString(d, SVG, ARTBOARD);
    const rect = items[0];
    // translate(10,10) applied to a 20x20 rect: still 20x20, and offset from
    // its sibling by the same amount it had inside the <g>.
    expect(rect.bounds.width).toBeCloseTo(20, 5);
    expect(items[1].bounds.center.subtract(rect.bounds.center).length).toBeCloseTo(
      Math.hypot(20, 20),
      3
    );
  });

  it("centres the import on the artboard", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const items = importSVGString(d, SVG, ARTBOARD);
    let b = items[0].bounds;
    for (const it of items.slice(1)) b = b.unite(it.bounds);
    expect(b.center.x).toBeCloseTo(200, 3);
    expect(b.center.y).toBeCloseTo(200, 3);
  });

  it("scales an oversized import down to fit", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const big = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="4000">
      <rect x="0" y="0" width="4000" height="4000" fill="red"/></svg>`;
    const [item] = importSVGString(d, big, ARTBOARD);
    expect(item.bounds.width).toBeLessThanOrEqual(ARTBOARD.width);
    expect(item.bounds.width).toBeCloseTo(360, 3); // 400 * 0.9 margin
  });

  it("selects what it imported", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const items = importSVGString(d, SVG, ARTBOARD);
    expect(d.project.selectedItems).toHaveLength(items.length);
  });

  it("puts the template layer at the back and leaves the drawing layer active", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const drawing = d.project.activeLayer;
    const layer = templateLayer(d);

    expect(layer.name).toBe(TEMPLATE_LAYER);
    expect(d.project.layers[0]).toBe(layer);
    expect(d.project.activeLayer).toBe(drawing);
  });

  it("takes templates out of an export and puts them back where they were", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    const drawing = d.project.activeLayer;
    const layer = templateLayer(d);
    const marker = new d.scope.Path.Rectangle({ point: [0, 0], size: [5, 5] });
    layer.addChild(marker);

    const restore = hideTemplates(d);
    expect(d.project.layers).not.toContain(layer);
    expect(d.project.layers).toContain(drawing);
    // Hiding is not enough: Paper exports an invisible item as
    // visibility="hidden", payload and all.
    expect(d.project.exportSVG({ asString: true })).not.toContain("visibility");

    restore();
    expect(d.project.layers[0]).toBe(layer);
    expect(layer.children).toContain(marker);
  });

  it("reuses the template layer instead of stacking new ones", () => {
    const d = createDocument(ARTBOARD.width, ARTBOARD.height);
    expect(templateLayer(d)).toBe(templateLayer(d));
    expect(d.project.layers.filter((l) => l.name === TEMPLATE_LAYER)).toHaveLength(1);
  });
});
