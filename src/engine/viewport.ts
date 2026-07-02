export interface Vec2 {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface ViewState {
  zoom: number;
  center: Vec2;
}

const MIN_ZOOM = 0.03;
const MAX_ZOOM = 64;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

/** Zoom by `factor` while keeping `pivot` (document coords) fixed on screen. */
export function zoomAtPoint(state: ViewState, factor: number, pivot: Vec2): ViewState {
  const zoom = clampZoom(state.zoom * factor);
  const k = state.zoom / zoom;
  return {
    zoom,
    center: {
      x: pivot.x + (state.center.x - pivot.x) * k,
      y: pivot.y + (state.center.y - pivot.y) * k,
    },
  };
}

/** Zoom + center so `bounds` fits within `viewSize` (with a little padding). */
export function fitBounds(
  viewSize: Size,
  bounds: { x: number; y: number; width: number; height: number },
  padding = 0.04
): ViewState {
  const raw =
    Math.min(viewSize.width / bounds.width, viewSize.height / bounds.height) * (1 - padding);
  return {
    zoom: clampZoom(raw),
    center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  };
}
