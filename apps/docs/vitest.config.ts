import { defineConfig } from "vitest/config";

import { DocsShardSequencer } from "./test/shard-sequencer.ts";

const shared = {
  testTimeout: 30_000,
  hookTimeout: 60_000,
};

/**
 * The e2e files that guard the docs site's own apps, the theme studio and the landing, rather
 * than Fuse. `DOCS_E2E_SITE=skip` leaves them out: the merge workflow sets it on a PR that
 * changes nothing under apps/docs, and every push to main runs them.
 */
const SITE_TESTS = ["test/studio/**/*.browser.test.ts", "test/landing*.browser.test.ts"];

export default defineConfig({
  test: {
    // Gives each demo coverage group a CI shard of its own (test/shard-sequencer.ts).
    sequence: { sequencer: DocsShardSequencer },
    projects: [
      {
        // The app's tsconfig leaves `jsx: "preserve"` for Next to compile; the unit
        // project imports server view modules that render JSX (`api-view.tsx`), so
        // esbuild transforms it here instead of handing preserved JSX to Vite.
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["**/*.browser.test.*"],
          globalSetup: ["test/global-setup.ts"],
          ...shared,
          // Projects with different worker limits need groups of their own for one unfiltered run.
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          exclude: process.env.DOCS_E2E_SITE === "skip" ? SITE_TESTS : [],
          globalSetup: ["test/global-setup-e2e.ts"],
          ...shared,
          // Two browser files run at once against the one `next start` server global setup
          // starts. Each file launches its own Chromium and each test opens its own context, so
          // files share only that server. Two workers held over three full local runs; widen it
          // only after the same check.
          fileParallelism: true,
          maxWorkers: 2,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
