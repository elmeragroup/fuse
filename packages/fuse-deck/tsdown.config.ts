import { defineConfig } from "tsdown";

/**
 * The command line, bundled for Node. Its dependencies stay external, so the packed package
 * installs them, and `package.json` is inlined for `--version`.
 */
export default defineConfig({
  entry: { bin: "src/bin.ts" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  fixedExtension: true,
  dts: false,
  clean: true,
});
