import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // The suite starts the step as Node processes, which take seconds under a loaded `pnpm check`.
    testTimeout: 60_000,
  },
});
