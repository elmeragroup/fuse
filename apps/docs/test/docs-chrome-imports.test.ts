import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mdx"]);

/** Every authored source file under `apps/docs/src`, excluding the generated tree. */
function docsSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      if (entry === "generated") {
        continue;
      }
      files.push(...docsSourceFiles(absolute));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
      files.push(absolute);
    }
  }
  return files;
}

const SIDEBAR_ROUTE = "src/app/(docs)/components/sidebar/";

/**
 * The Sidebar component page and its demos are the one place the library Sidebar may be
 * imported: they are the component's documentation (docs-site.md §6), not docs chrome.
 */
function isSidebarPage(file: string): boolean {
  return path.relative(docsRoot, file).split(path.sep).join("/").startsWith(SIDEBAR_ROUTE);
}

function isSidebarDemo(file: string): boolean {
  return path.relative(docsRoot, file).split(path.sep).join("/").startsWith(`${SIDEBAR_ROUTE}demos/`);
}

const SIDEBAR_IMPORT = /from\s+["']@elmeragroup\/ui\/sidebar["']/u;
const SIDEBAR_FROM_BARREL = /import\s*\{[^}]*\bSidebar\b[^}]*\}\s*from\s+["']@elmeragroup\/ui["']/u;

describe("docs chrome never composes the library Sidebar (conventions.md, sidebar ticket 73)", () => {
  it("imports @elmeragroup/ui/sidebar only from the Sidebar page's own demos", () => {
    const offenders = docsSourceFiles(path.join(docsRoot, "src"))
      .filter((file) => !isSidebarPage(file))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return SIDEBAR_IMPORT.test(source) || SIDEBAR_FROM_BARREL.test(source);
      })
      .map((file) => path.relative(docsRoot, file));
    expect(offenders).toEqual([]);
  });

  it("still sees the Sidebar demos, so the exclusion is not vacuous", () => {
    const demos = docsSourceFiles(path.join(docsRoot, "src")).filter(isSidebarDemo);
    expect(demos.length).toBeGreaterThanOrEqual(5);
    for (const demo of demos) {
      expect(SIDEBAR_IMPORT.test(readFileSync(demo, "utf8")), demo).toBe(true);
    }
  });
});
