import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { TestProjectInlineConfiguration } from "vitest/config";

import { mediaCommands } from "./test/media-commands.ts";
import { pointerCommands } from "./test/pointer-commands.ts";

const BROWSER_TESTS = ["src/**/*.browser.test.tsx"];

/** Browser files that copy and paste through Chromium's shared clipboard, named by convention. */
const CLIPBOARD_TESTS = "**/*.clipboard.browser.test.tsx";

/**
 * Browser files that emulate touch through CDP or tap through Playwright's touchscreen, named by
 * convention.
 */
const TOUCH_TESTS = "**/*.touch.browser.test.tsx";

/** Browser files that exercise production-only behavior, named by convention. */
const PRODUCTION_TESTS = "**/*.production.browser.test.tsx";

/** Browser files whose output every engine must write alike, as `.ts` or `.tsx`. */
const ENGINES_TESTS = "**/*.engines.browser.test.{ts,tsx}";

/** Browser files that run under `prefers-reduced-motion: reduce` in every engine, named by convention. */
const REDUCED_MOTION_TESTS = "**/*.reduced-motion.browser.test.tsx";

/**
 * The test iframe's size, Vitest's default, which every browser context also opens at. Vitest 5
 * opens each page at Playwright's 1280 × 720 and resizes it before a file runs, and under load a
 * file has run in the unresized page. A page shorter than its iframe leaves the iframe's bottom
 * 176 px outside the viewport, where Playwright cannot click a toast.
 */
const VIEWPORT = { width: 414, height: 896 } as const;

declare module "vitest" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest types `provide`/`inject` by interface declaration merging; a type alias cannot augment.
  interface ProvidedContext {
    /** The IANA zone a unit project's process runs in, which a zone-sensitive test confirms. */
    timeZone: string;
  }
}

/** The unit files whose results could depend on the process's time zone. */
const ZONE_TESTS = [
  "src/components/chart/*.test.ts",
  "src/components/chart/format/*.test.ts",
  "src/components/chart/layout/*.test.ts",
  "src/components/data-table/*.test.ts",
  "src/intl/*.test.ts",
];

/**
 * A Node project whose process runs in one IANA zone. The time zone is a project dimension, as the
 * engine and the motion preference are, so no result depends on the machine's zone.
 */
function unitProject(name: string, timeZone: string, include: string[]): TestProjectInlineConfiguration {
  return {
    test: {
      name,
      environment: "node",
      include,
      exclude: ["**/*.browser.test.*", "**/*.test-d.*"],
      // TZ is one value per process, so each project's files run in forks, never in threads that
      // share a process with another project's zone. format.test.ts and x-domain.test.ts assert
      // the zone each file runs in.
      pool: "forks",
      env: { TZ: timeZone },
      provide: { timeZone },
      // Outside the browser, Vitest blanks CSS ids that `test.css` leaves out. The
      // consumer-build helper reads stylesheet text through `?raw`.
      css: { include: [/\.css\?raw$/] },
    },
  };
}

function browserProject(
  name: string,
  options: { include?: string[]; exclude?: string[]; fileParallelism?: boolean; groupOrder?: number },
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
      include: options.include ?? BROWSER_TESTS,
      exclude: options.exclude,
      fileParallelism: options.fileParallelism,
      // A project with a later group runs once every earlier group has finished.
      sequence: { groupOrder: options.groupOrder ?? 0 },
      browser: {
        enabled: true,
        headless: true,
        viewport: VIEWPORT,
        provider: playwright({
          ...provider,
          contextOptions: { viewport: VIEWPORT, ...provider.contextOptions },
        }),
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
      // Oslo has an offset and summer time, and matches local runs. The d3 fixtures replay their
      // dates in Los Angeles themselves.
      unitProject("unit", "Europe/Oslo", ["src/**/*.test.ts", "test/**/*.test.ts"]),
      // The zone-sensitive files again, behind and ahead of UTC, one zone with summer time and
      // one without.
      unitProject("unit-new-york", "America/New_York", ZONE_TESTS),
      unitProject("unit-tokyo", "Asia/Tokyo", ZONE_TESTS),
      browserProject("browser", {
        exclude: [CLIPBOARD_TESTS, ENGINES_TESTS, PRODUCTION_TESTS, TOUCH_TESTS, REDUCED_MOTION_TESTS],
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
      // and React as a production build, with the matching non-development JSX runtime. Its
      // smoothness judge times long tasks, which other pages running on the same cores lengthen,
      // so the project runs after every other project, one file at a time.
      {
        ...browserProject("browser-production", {
          include: [`src/${PRODUCTION_TESTS}`],
          fileParallelism: false,
          groupOrder: 1,
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
      // Touch emulation goes through CDP and covers the whole page the browser project's
      // parallel files share, so it would switch off `(hover: hover)`, and every Tailwind
      // `hover:` paint, in a neighbouring file. A real tap through Playwright's touchscreen also
      // needs a context with touch. The files that emulate touch or tap end in
      // `.touch.browser.test.tsx` and run one at a time here.
      browserProject(
        "browser-touch",
        { include: [`src/${TOUCH_TESTS}`], fileParallelism: false },
        ["chromium"],
        { contextOptions: { hasTouch: true } }
      ),
    ],
  },
});
