import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Keep the application bundle when adding the independent legacy hero entry.
    emptyOutDir: false,
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: "src/embed/CloudiaHero.ts",
      name: "CloudiaHero",
      fileName: "cloudia-hero",
      formats: ["iife", "es"],
    },
    rollupOptions: {
      output: {
        exports: "named",
      },
    },
  },
});
