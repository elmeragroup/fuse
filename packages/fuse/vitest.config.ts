import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { pageSizeCommands } from "./test/page-size-commands.ts";
import { pointerCommands } from "./test/pointer-commands.ts";

const BROWSER_TESTS = ["src/**/*.browser.test.tsx"];

/** Browser files that copy and paste through Chromium's shared clipboard, named by convention. */
const CLIPBOARD_TESTS = "**/*.clipboard.browser.test.tsx";

/**
 * Browser files whose output Chromium and WebKit must write alike, as `.ts` or `.tsx`: formatted
 * text and hydration, named by convention.
 */
const ENGINES_TESTS = "**/*.engines.browser.test.{ts,tsx}";

/**
 * The test iframe's size, Vitest's default, which every browser context also opens at. Vitest
 * sizes the page before each file runs, but skips a size it believes it already set, so a file can
 * start in a page an earlier file left at another size, as a cleared CDP metrics override does, or
 * scrolled a few pixels. A page shorter than its iframe leaves the iframe's bottom outside the
 * viewport, where Playwright cannot click. The setup file `test/page-frame-setup.ts` sizes such a
 * page to the frame before each file's first test.
 */
const VIEWPORT = { width: 414, height: 896 } as const;

/**
 * Every project's test timeout: a hang guard, not a budget. No Fuse test asserts how long it
 * takes, and a test's wall time scales with how starved its machine is. The chart layout
 * property tests are pure arithmetic that take about a second alone and over 5 s, Vitest's
 * default, under a `pnpm check` that shares the machine; a browser wait lasts as long as the
 * browser takes to deliver its event. A real hang still fails here.
 */
const HANG_GUARD = 30_000;

function browserProject(
  name: string,
  options: {
    include?: string[];
    exclude?: string[];
    fileParallelism?: boolean;
  },
  browsers: readonly ("chromium" | "webkit")[] = ["chromium"]
): TestProjectInlineConfiguration {
  return {
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        // The streamed-hydration tests server-render in the page.
        "react-dom/server",
        "react/jsx-runtime",
        "@base-ui/react/button",
        "@base-ui/react/direction-provider",
        "@base-ui/react/drawer",
        "@base-ui/react/scroll-area",
        "@base-ui/react/merge-props",
        "@base-ui/react/use-render",
        "@base-ui/react/toggle",
        "@base-ui/react/toggle-group",
        "@base-ui/react",
        "@base-ui/react/toast",
        "@base-ui/react/internals/field-constants",
        "@base-ui/react/internals/field-register-control",
        "@base-ui/react/internals/field-root-context",
        "@base-ui/react/internals/form-context",
        "@base-ui/react/internals/labelable-provider",
        "@base-ui/react/internals/noop",
        "@base-ui/react/internals/useRenderElement",
        "@base-ui/react/internals/useValueChanged",
        "@tanstack/react-table",
        "@tanstack/react-virtual",
        // The browser suites' accessibility pass.
        "axe-core",
        "clsx",
        "tailwind-merge",
        "tailwind-variants",
        // The layer browser tests compile fuse.css in the page.
        "tailwindcss",
        "tailwindcss-react-aria-components",
      ],
    },
    test: {
      name,
      setupFiles: ["./test/page-frame-setup.ts"],
      // Hang guards, not budgets. Every expect.poll and expect.element waits on an event the
      // browser delivers in its own time, such as an IntersectionObserver report or a frame, and
      // Vitest's default second failed WebKit hydration on a saturated CI runner.
      testTimeout: HANG_GUARD,
      expect: { poll: { timeout: 10_000 } },
      include: options.include ?? BROWSER_TESTS,
      exclude: options.exclude,
      fileParallelism: options.fileParallelism,
      browser: {
        enabled: true,
        headless: true,
        viewport: VIEWPORT,
        provider: playwright({ contextOptions: { viewport: VIEWPORT } }),
        instances: browsers.map((browser) => ({ browser })),
        commands: { ...pointerCommands, ...pageSizeCommands },
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
          // Oslo has an offset and summer time, and matches local runs, so no result depends on
          // the machine's zone. The d3 fixtures replay their dates in Los Angeles themselves.
          env: { TZ: "Europe/Oslo" },
          // TZ is read per process, so the files run in forks, never in threads that would share
          // the runner's zone.
          pool: "forks",
          // Outside the browser, Vitest blanks CSS ids that `test.css` leaves out. The
          // consumer-build helper reads stylesheet text through `?raw`.
          css: { include: [/\.css\?raw$/] },
          testTimeout: HANG_GUARD,
        },
      },
      browserProject("browser", { exclude: [CLIPBOARD_TESTS, ENGINES_TESTS] }),
      // Node and each engine carry their own Intl data, and one differing space fails hydration.
      browserProject("browser-engines", { include: [`src/${ENGINES_TESTS}`] }, ["chromium", "webkit"]),
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
