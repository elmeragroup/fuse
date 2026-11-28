import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          // The server suites, on a fixture catalog: they need no docs generation.
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.catalog.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          // Checks on the catalog `docs#generate` writes, which `test:catalog` waits for.
          name: "catalog",
          include: ["test/**/*.catalog.test.ts"],
        },
      },
    ],
  },
});
