import { defineConfig } from "vitest/config";

import base from "./vitest.config.ts";

/**
 * The tests that drive Chromium, as `*.chromium.test.ts` names them. `test:capture` runs them in the
 * figma-capture job, which sets up Playwright; the package's `test` runs in a job with no browser,
 * so the base config leaves them out. They keep the base config's hang guard.
 */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: base.test?.testTimeout,
    hookTimeout: base.test?.hookTimeout,
    include: ["src/**/*.chromium.test.ts"],
  },
});
