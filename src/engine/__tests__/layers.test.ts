import { describe, it, expect } from "vitest";
import { createDocument } from "@/engine/document";
import {
  listLayers,
  addLayer,
  renameLayer,
  setLayerVisible,
  setLayerLocked,
  moveLayer,
} from "../layers";

describe("layer helpers", () => {
  it("lists the default layer", () => {
    const doc = createDocument(200, 200);
    expect(listLayers(doc).length).toBe(1);
  });

  it("addLayer creates a named layer at top", () => {
    const doc = createDocument(200, 200);
    addLayer(doc, "Sketch");
    const layers = listLayers(doc);
    expect(layers.length).toBe(2);
    expect(layers[0].name).toBe("Sketch");
  });

  it("rename / visible / locked mutate the layer", () => {
    const doc = createDocument(200, 200);
    const l = addLayer(doc, "L");
    renameLayer(doc, l.id, "Renamed");
    setLayerVisible(doc, l.id, false);
    setLayerLocked(doc, l.id, true);
    const info = listLayers(doc).find((x) => x.id === l.id)!;
    expect(info.name).toBe("Renamed");
    expect(info.visible).toBe(false);
    expect(info.locked).toBe(true);
  });

  it("moveLayer changes z-order", () => {
    const doc = createDocument(200, 200);
    const a = addLayer(doc, "A");
    addLayer(doc, "B");
    moveLayer(doc, a.id, 1);
    expect(listLayers(doc)[0].name).toBe("A");
  });
});
