import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { pointerCommands } from "./test/pointer-commands.ts";

const BROWSER_TESTS = ["src/**/*.browser.test.tsx"];

/** Browser files that copy and paste through Chromium's shared clipboard. */
const CLIPBOARD_FILES = [
  "src/components/phone-number-field/phone-state.browser.test.tsx",
  "src/components/text-field/text-field.browser.test.tsx",
];

function browserProject(
  name: string,
  files: { include?: string[]; exclude?: string[]; fileParallelism?: boolean }
): TestProjectInlineConfiguration {
  return {
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
        "@base-ui/react/toast",
        "clsx",
        "tailwind-merge",
        "tailwind-variants",
      ],
    },
    test: {
      name,
      include: files.include ?? BROWSER_TESTS,
      exclude: files.exclude,
      fileParallelism: files.fileParallelism,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        commands: pointerCommands,
      },
    },
  };
}

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
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          exclude: ["**/*.browser.test.*", "**/*.test-d.*"],
        },
      },
      browserProject("browser", {
        exclude: CLIPBOARD_FILES,
      }),
      // Chromium keeps one clipboard for every file the browser project runs in parallel, so a
      // file that copies can overwrite what another is about to paste. The files that drive the
      // real clipboard share their own project and run one at a time.
      browserProject("browser-clipboard", {
        include: CLIPBOARD_FILES,
        fileParallelism: false,
      }),
    ],
  },
});
