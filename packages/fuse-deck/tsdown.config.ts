import { defineConfig } from "tsdown";

export default defineConfig([
  {
    // The command line, bundled for Node. Its dependencies stay external, so the packed package
    // installs them, and `package.json` is inlined for `--version`.
    entry: { bin: "src/bin.ts" },
    outDir: "dist",
    format: "esm",
    platform: "node",
    fixedExtension: true,
    dts: false,
    clean: ["dist/bin.mjs"],
  },
  {
    // The browser runtime the deck's Vite build compiles again. React, the JSX runtimes, Fuse and
    // the deck manifest stay external, so each resolves once, through the deck's Vite config, and
    // the page never holds two Reacts. It imports no Effect and no Node API.
    entry: { main: "src/runtime/main.tsx" },
    outDir: "dist/runtime",
    format: "esm",
    platform: "browser",
    tsconfig: "tsconfig.runtime.json",
    dts: false,
    clean: true,
    deps: {
      neverBundle: [/^react(?:-dom)?(?:\/.*)?$/, /^@elmeragroup\/fuse(?:\/.*)?$/, "virtual:fuse-deck"],
    },
    copy: [{ from: "src/runtime/deck.css", to: "dist/runtime" }],
  },
]);
