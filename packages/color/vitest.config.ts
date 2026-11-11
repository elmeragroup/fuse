import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // A hang guard, not a budget, as in Fuse's test projects. The property tests are pure
    // arithmetic whose wall time scales with how starved the CPU is: the OKLCH round trip's 10,000
    // runs take half of Vitest's default 5s on a heavily loaded machine (#517).
    testTimeout: 30_000,
  },
});
