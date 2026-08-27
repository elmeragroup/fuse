import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    typecheck: {
      enabled: false,
      include: ["src/**/*.test-d.tsx"],
      tsconfig: "./tsconfig.json",
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/*.browser.test.*", "**/*.test-d.*"],
        },
      },
      {
        optimizeDeps: {
          include: [
            "react",
            "react-dom",
            "react-dom/client",
            "react/jsx-runtime",
            "@base-ui/react/button",
            "@base-ui/react/drawer",
            "@base-ui/react/scroll-area",
            "@base-ui/react/merge-props",
            "@base-ui/react/use-render",
            "@base-ui/react/toggle",
            "@base-ui/react/toggle-group",
            "@base-ui/react",
            "clsx",
            "tailwind-merge",
            "tailwind-variants",
          ],
        },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
