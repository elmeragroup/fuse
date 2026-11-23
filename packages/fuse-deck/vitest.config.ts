import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // The deck model on real temporary directories, and the built bin spawned as a process.
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["**/*.browser.test.ts"],
          environment: "node",
          testTimeout: 60_000,
        },
      },
    ],
  },
});
