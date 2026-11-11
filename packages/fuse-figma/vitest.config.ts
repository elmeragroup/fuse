import { defineConfig } from "vitest/config";

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
    // The suites a worker runs share one module registry, so a worker imports the kit's modules
    // once and builds the kit twice apart: the component sets alone (`test/built-kit.ts`) and the
    // full kit the fake-file suites apply (`plugin/src/kit-fixture.ts`), which applies the full kit
    // and each cut kit to the fake file once. The shared kit fixtures are deep frozen
    // (`test/frozen.ts`), each test gets a fork of an applied file (`plugin/src/kit-fixture.ts`), no
    // suite mocks a module or stubs a global, and no module the suites import keeps state of its own
    // between calls.
    isolate: false,
    testTimeout: HANG_GUARD_MS,
    hookTimeout: HANG_GUARD_MS,
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "plugin/src/**/*.test.ts"],
  },
});
