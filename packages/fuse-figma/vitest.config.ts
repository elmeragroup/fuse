import { configDefaults, defineConfig } from "vitest/config";

/** Suites that launch Playwright's Chromium against the Fuse build, as `figma:compare` does. */
const CHROMIUM_TESTS = "src/**/*.chromium.test.ts";

export default defineConfig({
  test: {
    environment: "node",
    // The suites a worker runs share one module registry, so a worker imports the kit's modules
    // once and builds the kit three times apart: the component sets alone (`test/built-kit.ts`), the
    // full kit the fake-file suites apply (`plugin/src/kit-fixture.ts`), and the full kit in
    // `build-kit.test.ts`'s own `beforeAll`. The kit fixture applies the full kit and each cut kit
    // to the fake file once. The shared kit fixtures are deep frozen (`test/frozen.ts`), each test
    // gets a fork of an applied file (`plugin/src/kit-fixture.ts`), no suite mocks a module or stubs
    // a global, and no module the suites import keeps state of its own between calls.
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "test/**/*.test.ts", "plugin/src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, CHROMIUM_TESTS],
        },
      },
      {
        // `test:browser` runs it, in the CI leg that installs Chromium, after the Fuse build.
        extends: true,
        test: { name: "chromium", include: [CHROMIUM_TESTS], testTimeout: 120_000 },
      },
    ],
  },
});
