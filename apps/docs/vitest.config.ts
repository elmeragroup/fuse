import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";
import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

import { liveCodeLens } from "./scripts/lib/live-code-vite.ts";
import { PAGE_WAIT_GUARD } from "./test/page-wait-guard";

const shared = {
  hookTimeout: 60_000,
};

/**
 * Starts the route sweep first and keeps Vitest's order for the rest. The sweep is the longest
 * browser file by far, but on a cold CI run Vitest has no durations cached and orders by file
 * size, which put the sweep next to last and left one of the two workers idle at the end.
 */
class RouteSweepFirst extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const isSweep = (file: TestSpecification): boolean =>
      file.moduleId.endsWith("/test/routes.browser.test.ts");
    return [...sorted.filter(isSweep), ...sorted.filter((file) => !isSweep(file))];
  }
}

/**
 * The e2e files that guard the docs site's own apps, the theme studio and the landing, rather
 * than Fuse. `DOCS_E2E_SITE=skip` leaves them out: the merge workflow sets it on a PR that
 * changes nothing under apps/docs, and every push to main runs them.
 */
const SITE_TESTS = ["test/studio/**/*.browser.test.ts", "test/landing*.browser.test.ts"];

export default defineConfig({
  test: {
    // Vitest reads the sequencer from the root config only; it sorts both projects' files.
    sequence: { sequencer: RouteSweepFirst },
    projects: [
      {
        // The app's tsconfig leaves `jsx: "preserve"` for Next to compile; the unit
        // project imports server view modules that render JSX (`api-view.tsx`), so
        // esbuild transforms it here instead of handing preserved JSX to Vite.
        oxc: { jsx: { runtime: "automatic" } },
        // The Live code loader's rewrite, applied to component demos as the docs build applies it,
        // so the transparency test renders what the site renders (`?original` opts a module out).
        plugins: [liveCodeLens()],
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["**/*.browser.test.*"],
          globalSetup: ["test/global-setup.ts"],
          ...shared,
          testTimeout: 30_000,
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
          // The route sweep's concurrent tests: up to five pages at once in its one browser, and
          // never more than the machine has cores, so a 4-vCPU runner keeps four.
          maxConcurrency: Math.min(5, availableParallelism()),
          // A hang guard, not a budget: no docs e2e test asserts timing, and a flow that slows
          // under a loaded runner must not fail for it.
          testTimeout: 120_000,
          // The same for every expect.poll: a hang guard, where the default second is a budget.
          expect: { poll: { timeout: PAGE_WAIT_GUARD } },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
