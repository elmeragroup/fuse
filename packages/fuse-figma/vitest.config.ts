import { configDefaults, defineConfig } from "vitest/config";

/**
 * The test and hook timeout, a hang guard rather than a speed budget: it only has to catch a test
 * that never settles, so tests and hooks do not set their own. The work here is CPU-bound, and its
 * wall time scales with how starved the machine is. The kit fixture (`plugin/src/kit-fixture.ts`)
 * builds a whole in-memory Figma file, the full kit applied to it, which took 15–20 s at a load
 * average of 70 and 90–115 s at 130–270, and failed the 60 s hook timeout the snapshots suite once
 * set. So the guard sits far above Fuse's 30 s browser and unit guards, whose slowest honest runs
 * take seconds, and still well inside the CI job's 45 minutes.
 */
const HANG_GUARD_MS = 600_000;

export default defineConfig({
  test: {
    environment: "node",
    // The suites a worker runs share one module registry, so the component sets (`test/built-kit.ts`)
    // and the full kit (`fullKit()` in `plugin/test-support/kit-cache.ts`) resolve once per worker.
    // Where the kit comes from is the setup's choice (`plugin/test-support/kit-setup.ts`). Both are
    // deep frozen (`plugin/test-support/frozen.ts`), a test that calls `appliedFile()`
    // (`plugin/src/kit-fixture.ts`) gets its own fork of the applied file, no suite mocks a module or
    // stubs a global, and no module the suites import keeps state of its own between calls.
    isolate: false,
    globalSetup: ["plugin/test-support/kit-setup.ts"],
    // The fake-file suites reach the kit cache through a path the plugin's type check does not read,
    // and nothing imports the setup, so `vitest related` would select none of their consumers.
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/plugin/test-support/kit-*.ts"],
    testTimeout: HANG_GUARD_MS,
    hookTimeout: HANG_GUARD_MS,
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "plugin/src/**/*.test.ts"],
    // A test that drives Chromium runs under `vitest.chromium.config.ts`, in a job with a browser.
    exclude: ["**/node_modules/**", "**/*.chromium.test.ts"],
  },
});
