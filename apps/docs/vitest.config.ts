import { defineConfig } from "vitest/config";

const shared = {
  testTimeout: 30_000,
  hookTimeout: 60_000,
};

export default defineConfig({
  test: {
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
