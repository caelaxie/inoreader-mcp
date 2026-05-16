import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/worker.ts"],
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  shims: false,
  sourcemap: true,
  splitting: false,
  target: "node24"
});
