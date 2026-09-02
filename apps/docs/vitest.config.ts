import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's tsconfig leaves `jsx: "preserve"` for Next to compile; the unit project
  // imports server view modules that render JSX (`api-view.tsx`), so esbuild transforms
  // it here instead of handing preserved JSX to Vite.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["**/test/api-shadow.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
