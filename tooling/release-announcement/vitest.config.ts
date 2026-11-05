import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // The CLI suites start Node processes and git, which take seconds under a loaded `pnpm check`.
    testTimeout: 60_000,
  },
});
