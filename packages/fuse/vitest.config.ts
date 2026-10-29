import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { mediaCommands } from "./test/media-commands.ts";
import { pointerCommands } from "./test/pointer-commands.ts";

const BROWSER_TESTS = ["src/**/*.browser.test.tsx"];

/** Browser files that copy and paste through Chromium's shared clipboard, named by convention. */
const CLIPBOARD_TESTS = "**/*.clipboard.browser.test.tsx";

/** Browser files that emulate a touch pointer across Chromium's shared page, named by convention. */
const TOUCH_TESTS = "**/*.touch.browser.test.tsx";

/** Browser files that tap through Playwright's touchscreen in Chromium and WebKit, named by convention. */
const TAP_TESTS = "**/*.tap.browser.test.tsx";

/**
 * Browser files that drive the keyboard or move focus in every engine, named by convention. They
 * run one at a time, because parallel files share one page and its single keyboard focus.
 */
const KEYBOARD_TESTS = "**/*.keyboard.browser.test.tsx";

/** Browser files that exercise production-only behavior, named by convention. */
const PRODUCTION_TESTS = "**/*.production.browser.test.tsx";

/** Browser files whose output every engine must write alike, as `.ts` or `.tsx`. */
const ENGINES_TESTS = "**/*.engines.browser.test.{ts,tsx}";

/** Browser files that run under `prefers-reduced-motion: reduce` in every engine, named by convention. */
const REDUCED_MOTION_TESTS = "**/*.reduced-motion.browser.test.tsx";

function browserProject(
  name: string,
  files: { include?: string[]; exclude?: string[]; fileParallelism?: boolean },
  browsers: readonly ("chromium" | "firefox" | "webkit")[] = ["chromium"],
  provider: Parameters<typeof playwright>[0] = {}
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
        "@base-ui/react/drawer",
        "@base-ui/react/scroll-area",
        "@base-ui/react/merge-props",
        "@base-ui/react/use-render",
        "@base-ui/react/toggle",
        "@base-ui/react/toggle-group",
        "@base-ui/react",
        "@base-ui/react/toast",
        "@base-ui/react/internals/field-constants",
        "@base-ui/react/internals/field-root-context",
        "@base-ui/react/internals/form-context",
        "@base-ui/react/internals/labelable-provider",
        "@base-ui/react/internals/noop",
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
      include: files.include ?? BROWSER_TESTS,
      exclude: files.exclude,
      fileParallelism: files.fileParallelism,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(provider),
        instances: browsers.map((browser) => ({ browser })),
        commands: { ...pointerCommands, ...mediaCommands },
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
          // Outside the browser, Vitest blanks CSS ids that `test.css` leaves out. The
          // consumer-build helper reads stylesheet text through `?raw`.
          css: { include: [/\.css\?raw$/] },
        },
      },
      browserProject("browser", {
        exclude: [
          CLIPBOARD_TESTS,
          ENGINES_TESTS,
          KEYBOARD_TESTS,
          PRODUCTION_TESTS,
          TAP_TESTS,
          TOUCH_TESTS,
          REDUCED_MOTION_TESTS,
        ],
      }),
      // Node and each engine carry their own Intl data, and one differing space fails hydration.
      browserProject("browser-engines", { include: [`src/${ENGINES_TESTS}`] }, [
        "chromium",
        "firefox",
        "webkit",
      ]),
      // CDP emulates reduced motion in Chromium only, so Firefox and WebKit take it from the
      // Playwright context. The files that judge reduced motion in every engine share this project.
      browserProject(
        "browser-reduced-motion",
        { include: [`src/${REDUCED_MOTION_TESTS}`] },
        ["chromium", "firefox", "webkit"],
        { contextOptions: { reducedMotion: "reduce" } }
      ),
      // Vite replaces `process.env.NODE_ENV` at transform time, so `vi.stubEnv` cannot reach
      // production-only branches in the browser. This project compiles its files, their source
      // and React as a production build, with the matching non-development JSX runtime.
      {
        ...browserProject("browser-production", {
          include: [`src/${PRODUCTION_TESTS}`],
        }),
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        oxc: { jsx: { runtime: "automatic", development: false } },
      },
      // Chromium keeps one clipboard for every file the browser project runs in parallel, so a
      // file that copies can overwrite what another is about to paste. The files that drive the
      // real clipboard end in `.clipboard.browser.test.tsx`, share their own project and run one
      // at a time.
      browserProject("browser-clipboard", {
        include: [`src/${CLIPBOARD_TESTS}`],
        fileParallelism: false,
      }),
      // Parallel files share one page, and the page holds one keyboard focus. A file that focuses
      // its own frame takes the keys another file's Tab or arrow press sends, which Firefox showed
      // as a chart option test reading focus on its starting button. The files that drive the
      // keyboard or move focus in every engine end in `.keyboard.browser.test.tsx` and run one at
      // a time here.
      browserProject("browser-keyboard", { include: [`src/${KEYBOARD_TESTS}`], fileParallelism: false }, [
        "chromium",
        "firefox",
        "webkit",
      ]),
      // Touch emulation goes through CDP and covers the whole page the browser project's
      // parallel files share, so it would switch off `(hover: hover)`, and every Tailwind
      // `hover:` paint, in a neighbouring file. Each project opens its own page; the files that
      // emulate touch end in `.touch.browser.test.tsx` and run one at a time here.
      // A real tap needs a context with touch, which changes the page's pointer media for every
      // file in it. The files that tap through Playwright's touchscreen end in
      // `.tap.browser.test.tsx` and run one at a time in Chromium and WebKit here.
      browserProject(
        "browser-tap",
        { include: [`src/${TAP_TESTS}`], fileParallelism: false },
        ["chromium", "webkit"],
        { contextOptions: { hasTouch: true } }
      ),
      browserProject("browser-touch", {
        include: [`src/${TOUCH_TESTS}`],
        fileParallelism: false,
      }),
    ],
  },
});
