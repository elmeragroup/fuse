import { defineConfig } from "vitest/config";

const shared = { environment: "node", testTimeout: 60_000 } as const;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          exclude: ["**/*.browser.test.ts"],
          ...shared,
        },
      },
      {
        // Launches Playwright's Chromium, which only the merge workflow's browser job installs.
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          ...shared,
        },
      },
    ],
  },
});
