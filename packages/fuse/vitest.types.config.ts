import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["src/**/*.test-d.tsx"],
    typecheck: {
      enabled: true,
      // Not tsrs: tsrs 0.18 is a TypeScript 7.1 dev build and misses 7.1-beta inference regressions.
      checker: "tsc",
      include: ["src/**/*.test-d.tsx"],
      tsconfig: "./tsconfig.json",
    },
  },
});
