import { defineConfig } from "vitest/config";

/** The shadow suite is intentionally isolated from the write-capable docs test setup. */
export default defineConfig({
  test: {
    include: ["test/api-shadow.test.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
