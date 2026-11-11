import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

const componentsDir = path.join(docsRoot, "src/app/(docs)/components");
const blocksDir = path.join(docsRoot, "src/app/(docs)/blocks");

/**
 * Specifiers any consumer writes: React, the public entries, the date-cluster value type, and the
 * optional table peer every `@elmeragroup/fuse/data-table` consumer installs.
 */
const CONSUMER_SPECIFIERS = [
  /^react$/u,
  /^@elmeragroup\/fuse\//u,
  /^@internationalized\/date$/u,
  /^@tanstack\/react-table$/u,
];

/**
 * Reviewed demos whose scenarios the public API cannot express, with the allowed
 * non-public imports. Review a new exception here rather than deriving it from demos.
 */
const CARVE_OUTS = new Map<string, readonly string[]>([
  ["calendar/demos/calendar-rtl.tsx", ["react-aria-components"]],
  // A year of hours would fill the demo's printed source, so it reads one data module.
  ["chart/demos/chart-table.tsx", ["./data/hourly-year"]],
  // Two months of hours for the month switch's Sparklines, 1,465 values.
  ["chart/demos/chart-month-usage-and-price.tsx", ["./data/no1-household-hourly-2025-09-2025-10"]],
  ["line-chart/demos/line-chart-large.tsx", ["../../chart/demos/data/hourly-year"]],
  // The 24-hour profile averages the same two months of hours by clock hour.
  [
    "radar-chart/demos/radar-chart-hours.tsx",
    ["../../chart/demos/data/no1-household-hourly-2025-09-2025-10"],
  ],
  // The clock's day, week and last-week demos read the same two months of hours.
  [
    "clock-chart/demos/clock-chart-load-profile.tsx",
    ["../../chart/demos/data/no1-household-hourly-2025-09-2025-10"],
  ],
  [
    "clock-chart/demos/clock-chart-last-week.tsx",
    ["../../chart/demos/data/no1-household-hourly-2025-09-2025-10"],
  ],
  ["clock-chart/demos/clock-chart-week.tsx", ["../../chart/demos/data/no1-household-hourly-2025-09-2025-10"]],
  ["date-field/demos/date-field-date-input.tsx", ["react-aria-components"]],
  // Link's router demos show `render` composing a router's link: the docs app's own, and React
  // Aria's, which routes through UiProviders.
  ["link/demos/link-next.tsx", ["next/link"]],
  ["link/demos/link-react-aria.tsx", ["react-aria-components"]],
  // The router-link demo shows `render` composing the docs app's own router link.
  ["navigation-menu/demos/navigation-menu-router-link.tsx", ["next/link"]],
  ["scroll-area/demos/scroll-area-composed.tsx", ["@base-ui/react/scroll-area"]],
  // The server demo needs a consumer's own "use client" rows to pass its SubSections through.
  ["selection-item/demos/selection-item-server.tsx", ["./client/plan-rows"]],
  // UiProviders routes React Aria's links, so its demo renders one.
  ["ui-providers/demos/ui-providers-basic.tsx", ["react-aria-components"]],
]);

/**
 * Every specifier a demo module can name: `import … from`, a side-effect `import "x"`,
 * `export … from`, and dynamic `import("x")`. A carve-out lock that only saw the first
 * form would wave the others through.
 */
const IMPORT_SPECIFIER =
  /(?:\b(?:import|export)\s[^;]*?\sfrom\s+|^\s*import\s+|\bimport\s*\(\s*)["']([^"']+)["']/gmu;

function demoFiles(): string[] {
  const files: string[] = [];
  for (const slug of readdirSync(componentsDir)) {
    const demosDir = path.join(componentsDir, slug, "demos");
    let entries: string[];
    try {
      entries = readdirSync(demosDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith(".tsx")) {
        files.push(path.join(demosDir, entry));
      }
    }
  }
  return files;
}

function specifiersOf(file: string): string[] {
  // oxlint-disable-next-line fuse/no-source-reading-tests -- consumer contract: a demo imports only what a consumer can, against the reviewed carve-out inventory above
  return [...readFileSync(file, "utf8").matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? "");
}

function relativeDemo(file: string): string {
  return path.relative(componentsDir, file).split(path.sep).join("/");
}

describe("demos import only what a consumer could", () => {
  it("keeps every non-public specifier of the whole demo inventory inside the carve-out", () => {
    const offenders: string[] = [];
    const files = demoFiles();
    // The inventory must be the real one, so the check is not vacuous.
    expect(files.length).toBeGreaterThan(250);
    for (const file of files) {
      const allowed = CARVE_OUTS.get(relativeDemo(file)) ?? [];
      for (const specifier of specifiersOf(file)) {
        const isConsumer = CONSUMER_SPECIFIERS.some((pattern) => pattern.test(specifier));
        if (!isConsumer && !allowed.includes(specifier)) {
          offenders.push(`${relativeDemo(file)}: ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses every carve-out it grants, so the list cannot go stale", () => {
    for (const [demo, specifiers] of CARVE_OUTS) {
      const imported = specifiersOf(path.join(componentsDir, demo));
      for (const specifier of specifiers) {
        expect(imported, demo).toContain(specifier);
      }
    }
  });
});

/**
 * What a block may import beyond a demo's specifiers, reviewed: a block is a whole Next app, so it
 * routes with Next's own `Link` and router hooks, and it is several files, so it imports its own
 * siblings. Nothing reaches outside the block's folder, so a newcomer copies the folder as it is.
 */
const BLOCK_SPECIFIERS = [/^next\/link$/u, /^next\/navigation$/u];

/** Every file of every block, by its block's directory. */
function blockFiles(): { dir: string; file: string }[] {
  return readdirSync(blocksDir).flatMap((slug) => {
    const dir = path.join(blocksDir, slug, "demos");
    return readdirSync(dir)
      .filter((file) => /\.tsx?$/u.test(file))
      .map((file) => ({ dir, file }));
  });
}

describe("blocks import only what a consumer could", () => {
  it("imports React, Fuse's public entries, TanStack Table, Next's routing and its own files", () => {
    const files = blockFiles();
    // The app shell's files, so the check is not vacuous.
    expect(files.length).toBeGreaterThanOrEqual(13);
    const offenders: string[] = [];
    for (const { dir, file } of files) {
      const siblings = new Set(readdirSync(dir).map((name) => `./${name.replace(/\.tsx?$/u, "")}`));
      for (const specifier of specifiersOf(path.join(dir, file))) {
        const allowed =
          CONSUMER_SPECIFIERS.some((pattern) => pattern.test(specifier)) ||
          BLOCK_SPECIFIERS.some((pattern) => pattern.test(specifier)) ||
          siblings.has(specifier);
        if (!allowed) offenders.push(`${path.relative(blocksDir, dir)}/${file}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
