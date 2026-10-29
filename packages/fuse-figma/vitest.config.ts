import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "plugin/src/**/*.test.ts"],
    environment: "node",
    // The suites a worker runs share one module registry, so a worker imports the kit's modules,
    // builds the kit and applies it to the fake file once. The shared kit fixtures are deep frozen
    // (`test/frozen.ts`), each test gets a fork of the applied file (`plugin/src/kit-fixture.ts`),
    // no suite mocks a module or stubs a global, and no module the suites import keeps state of its
    // own between calls.
    isolate: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
