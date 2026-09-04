import type paper from "paper";
import type { EditorDoc } from "./document";

export type ClipboardPayload =
  | { type: "objects"; items: string[] }
  | { type: "text"; content: string };

let clipboard: ClipboardPayload | null = null;

export function getClipboard(): ClipboardPayload | null {
  return clipboard;
}

export function setClipboard(payload: ClipboardPayload | null): void {
  clipboard = payload;
}

/** Best-effort mirror to the system clipboard (no-op when unavailable). */
function mirrorSystemClipboard(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

/** Copy text: store in-app and mirror to the system clipboard for cross-app paste. */
export function copyText(text: string): void {
  setClipboard({ type: "text", content: text });
  mirrorSystemClipboard(text);
}

/**
 * Read text for pasting: prefer the system clipboard (so text copied in other
 * apps works), falling back to the in-app clipboard when it's unavailable.
 */
export async function readClipboardText(): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    } catch {
      // Permission denied or unsupported — fall through to the in-app clipboard.
    }
  }
  const cb = getClipboard();
  return cb?.type === "text" ? cb.content : "";
}

const PASTE_OFFSET = 12;

/**
 * Copy canvas items to the in-app clipboard as serialized JSON. Descendants of
 * other copied items are dropped first — Paper's `selectedItems` reports a
 * selected Group and each of its children, and copying both would paste the
 * children twice. Also clears any mirrored system-clipboard text so a later
 * text paste doesn't resurrect a stale earlier copy (a copy replaces the
 * clipboard, matching native-app convention).
 */
export function copyItems(items: paper.Item[]): void {
  const top = items.filter((it) => !items.some((o) => o !== it && it.isDescendant(o)));
  if (top.length === 0) return;
  setClipboard({ type: "objects", items: top.map((it) => it.exportJSON()) });
  mirrorSystemClipboard("");
}

/**
 * Paste previously copied objects into the active layer, offset from their
 * original position, and return the new items. No-op (returns []) when the
 * clipboard doesn't hold objects.
 */
export function pasteItems(doc: EditorDoc): paper.Item[] {
  const cb = getClipboard();
  if (!cb || cb.type !== "objects") return [];
  doc.scope.activate();
  doc.project.deselectAll();
  const pasted: paper.Item[] = [];
  for (const json of cb.items) {
    // Project#importJSON keeps Groups intact (importing into a temp Group
    // would merge into it and lose all but the first child).
    const item = doc.project.importJSON(json) as unknown as paper.Item | null;
    if (!item) continue;
    doc.project.activeLayer.addChild(item);
    item.position = item.position.add(new doc.scope.Point(PASTE_OFFSET, PASTE_OFFSET));
    item.selected = true;
    pasted.push(item);
  }
  return pasted;
}
