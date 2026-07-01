// Test setup: let Paper.js run under jsdom without native node-canvas.
//
// Paper switches to its browser code path whenever a DOM is present, and then
// asks every <canvas> for a 2D context. jsdom can't provide one without the
// native `canvas` package. But our unit tests never RASTERIZE — they do pure
// path geometry, boolean ops, and SVG export (which uses `document`, not a
// canvas). So we stub `getContext` to hand back a no-op 2D context proxy:
// enough for Paper to initialize, nothing actually drawn.
//
// Only affects tests. The browser build uses the real canvas.

const noop = () => undefined;

function makeStubContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "getImageData")
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === "createImageData")
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (prop === "getContextAttributes") return () => ({});
      // Any other property (fillRect, save, beginPath, style props…) → no-op.
      return noop;
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
}

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement
  ): CanvasRenderingContext2D {
    return makeStubContext(this);
  } as HTMLCanvasElement["getContext"];
}
