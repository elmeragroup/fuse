import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["src/**/*.test-d.tsx"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.tsx"],
      tsconfig: "./tsconfig.json",
    },
  },
});
