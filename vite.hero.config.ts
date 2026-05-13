import { defineConfig } from "vite";

export default defineConfig({
  build: {
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
