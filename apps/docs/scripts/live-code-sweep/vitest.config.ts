import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { liveCodeLens } from "../lib/live-code-vite.ts";

/**
 * Runs the Live code sweep (`sweep.ts`). The plugin applies the Turbopack loader's own rewrite to
 * every component demo, so the sweep renders the demos the site renders.
 */
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [liveCodeLens()],
  test: {
    include: ["scripts/live-code-sweep/sweep.ts"],
    testTimeout: 600_000,
  },
});
