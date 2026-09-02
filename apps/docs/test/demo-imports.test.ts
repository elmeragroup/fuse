import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

const componentsDir = path.join(docsRoot, "src/app/(docs)/components");

/** Specifiers any consumer writes: React, the public entries, and the date-cluster value type. */
const CONSUMER_SPECIFIERS = [/^react$/u, /^@elmeragroup\/ui\//u, /^@internationalized\/date$/u];

/**
 * The docs-site.md §6 carve-out, verbatim: the demos whose spec §10 scenario the public API
 * cannot express, and the one non-public specifier each may import. Closed list — a new
 * entry amends §6 first.
 */
const CARVE_OUTS = new Map<string, readonly string[]>([
  ["calendar/demos/calendar-rtl.tsx", ["react-aria-components"]],
  ["date-field/demos/date-field-date-input.tsx", ["react-aria-components"]],
  ["scroll-area/demos/scroll-area-composed.tsx", ["@base-ui/react/scroll-area"]],
]);

const IMPORT_SPECIFIER = /^import\s[^;]*?\sfrom\s+["']([^"']+)["']/gmu;

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
  return [...readFileSync(file, "utf8").matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? "");
}

function relativeDemo(file: string): string {
  return path.relative(componentsDir, file).split(path.sep).join("/");
}

describe("demos import only what a consumer could (docs-site.md §6)", () => {
  it("keeps every non-public specifier inside the §6 carve-out", () => {
    const offenders: string[] = [];
    for (const file of demoFiles()) {
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

  it("sees the whole demo inventory, so the check is not vacuous", () => {
    expect(demoFiles().length).toBeGreaterThan(250);
  });
});
