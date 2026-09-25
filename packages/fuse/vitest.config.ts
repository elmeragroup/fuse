import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { pointerCommands } from "./test/pointer-commands.ts";

const BROWSER_TESTS = ["src/**/*.browser.test.tsx"];

/** Browser files that copy and paste through Chromium's shared clipboard, named by convention. */
const CLIPBOARD_TESTS = "**/*.clipboard.browser.test.tsx";

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
        exclude: [CLIPBOARD_TESTS],
      }),
      // Chromium keeps one clipboard for every file the browser project runs in parallel, so a
      // file that copies can overwrite what another is about to paste. The files that drive the
      // real clipboard end in `.clipboard.browser.test.tsx`, share their own project and run one
      // at a time.
      browserProject("browser-clipboard", {
        include: [`src/${CLIPBOARD_TESTS}`],
        fileParallelism: false,
      }),
    ],
  },
});
