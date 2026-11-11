import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // A hang guard, not a budget, as in Fuse's projects. No test asserts how long it takes, and
    // the property tests are pure arithmetic whose wall time scales with how starved the machine
    // is: the 10,000-run sRGB round trip takes about a second alone and over 4 s under a shared
    // `pnpm check`, close to Vitest's 5 s default.
    testTimeout: 30_000,
  },
});
