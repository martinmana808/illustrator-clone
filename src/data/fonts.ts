// Curated popular Google Fonts (Figma-style picker). Loaded on demand via the
// Google Fonts CSS API; `document.fonts.load` ensures a family is ready before
// it's applied to canvas text.
export const SYSTEM_FONTS = ["sans-serif", "serif", "monospace"];

export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Oswald",
  "Nunito",
  "Merriweather",
  "Playfair Display",
  "Source Sans 3",
  "Work Sans",
  "Rubik",
  "DM Sans",
  "Bebas Neue",
  "Josefin Sans",
  "Quicksand",
  "Archivo",
  "Manrope",
  "Space Grotesk",
  "Libre Baskerville",
  "Lora",
  "PT Serif",
  "Dancing Script",
  "Pacifico",
  "Caveat",
  "Abril Fatface",
  "Anton",
  "Fira Sans",
  "Karla",
  "Mulish",
  "Barlow",
  "Cabin",
  "Comfortaa",
  "Righteous",
  "Sacramento",
  "Shrikhand",
  "Zilla Slab",
  "IBM Plex Mono",
];

export const ALL_FONTS = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

const loaded = new Set<string>();

/** Ensure a Google font is fetched + ready, then resolve. System fonts no-op. */
export async function ensureFont(family: string): Promise<void> {
  if (SYSTEM_FONTS.includes(family) || loaded.has(family)) return;
  if (typeof document === "undefined") return;
  loaded.add(family);
  const id = "gf-" + family.replace(/\s+/g, "-");
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") +
      ":wght@400;700&display=swap";
    document.head.appendChild(link);
  }
  try {
    await (document as Document & { fonts: FontFaceSet }).fonts.load(`16px "${family}"`);
  } catch {
    /* font load best-effort */
  }
}
