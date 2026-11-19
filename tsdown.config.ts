import { defineConfig } from "tsdown";

// ESM-only, unminified: consumers' bundlers minify, so shipping readable code
// costs them nothing and keeps the package auditable.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "browser",
  target: "es2020",
  dts: true,
  sourcemap: false,
  minify: false,
  clean: true,
});
