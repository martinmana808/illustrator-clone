import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // jsdom gives Paper.js a real `document` (needed for SVG export). The
    // setup file stubs the canvas 2D context so no native node-canvas is
    // required — unit tests never rasterize, only compute geometry + export SVG.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup-paper-dom.ts"],
  },
  resolve: {
    alias: {
      // Match the tsconfig "@/*" -> "src/*" path alias for tests.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
