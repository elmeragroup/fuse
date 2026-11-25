import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { keyCommands } from "./test/key-commands.ts";
import { mediaCommands } from "./test/media-commands.ts";
import { pageSizeCommands } from "./test/page-size-commands.ts";
import { pointerCommands } from "./test/pointer-commands.ts";
import { requestHoldCommands } from "./test/request-hold-commands.ts";

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
 * A hang guard, not a budget, which every project inherits as its test and hook timeout. No Fuse
 * test or hook asserts how long it takes, and its wall time scales with how starved its machine
 * is. Under load, the chart layout property tests ran past Vitest's 5 s test default. The
 * `afterEach` in `flag-source.test.ts` ran past the 10 s hook default while it reset its git
 * fixture. An awaited hang still fails here.
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
      ],
    },
    test: {
      name,
      setupFiles: ["./test/page-frame-setup.ts"],
      // A WebKit hydration check ran past Vitest's 1 s `expect.poll` default on a saturated CI
      // runner.
      expect: { poll: { timeout: 10_000 } },
      include: options.include ?? BROWSER_TESTS,
      exclude: options.exclude,
      browser: {
        enabled: true,
        headless: true,
        viewport: VIEWPORT,
        provider: playwright({ contextOptions: { viewport: VIEWPORT } }),
        // Each browser instance takes `fileParallelism` itself. At the project level Vitest turns
        // `false` into one worker, then lets `VITEST_MAX_WORKERS` replace that count; it clamps an
        // instance's workers to one after reading the variable, so only here does `false` hold.
        instances: browsers.map((browser) => ({ browser, fileParallelism: options.fileParallelism ?? true })),
        commands: {
          ...pointerCommands,
          ...keyCommands,
          ...mediaCommands,
          ...pageSizeCommands,
          ...requestHoldCommands,
        },
      },
    },
  };
}

export default defineConfig({
  test: {
    passWithNoTests: true,
    testTimeout: HANG_GUARD,
    hookTimeout: HANG_GUARD,
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
        },
      },
      browserProject("browser", { exclude: [CLIPBOARD_TESTS, ENGINES_TESTS] }),
      // Node and each engine carry their own Intl data, and one differing space fails hydration.
      browserProject("browser-engines", { include: [`src/${ENGINES_TESTS}`] }, ["chromium", "webkit"]),
      // Headless Chromium keeps one in-memory clipboard per browser process, never the system
      // pasteboard, so concurrent runs cannot read each other's copies. Within a run, though, every
      // file the browser project runs in parallel shares it, so a file that copies can overwrite
      // what another is about to paste. The files that drive the real clipboard end in
      // `.clipboard.browser.test.tsx`, share their own project and run one at a time, even under
      // `VITEST_MAX_WORKERS`.
      browserProject("browser-clipboard", {
        include: [`src/${CLIPBOARD_TESTS}`],
        fileParallelism: false,
      }),
    ],
  },
});
