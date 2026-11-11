import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

// The TypeScript side of this contract is lint: `no-restricted-imports` in `oxlint.config.ts` bans
// the library Sidebar across apps/docs/src outside the Sidebar page, the landing's app shell and
// the blocks' demos. Oxlint does not read MDX, so the pages' MDX is checked here.
const SOURCE_EXTENSIONS = new Set([".mdx"]);

/** Every authored MDX page under `apps/docs/src`, excluding the generated tree. */
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
/** The landing hero's Dashboard window, a product demo built on the library Sidebar. */
const LANDING_APP_SHELL = "src/app/(landing)/landing/app-shell/";
/** The blocks' own files: whole apps built on the library Sidebar, which their previews frame. */
const BLOCK_DEMOS = /^src\/app\/\(docs\)\/blocks\/[^/]+\/demos\//u;

/**
 * The Sidebar component page and its demos, the landing's Dashboard demo and the blocks are the
 * places the library Sidebar may be imported: they demonstrate the component, they are not docs
 * chrome.
 */
function isSidebarPage(file: string): boolean {
  const relative = path.relative(docsRoot, file).split(path.sep).join("/");
  return (
    relative.startsWith(SIDEBAR_ROUTE) || relative.startsWith(LANDING_APP_SHELL) || BLOCK_DEMOS.test(relative)
  );
}

const SIDEBAR_IMPORT = /from\s+["']@elmeragroup\/fuse\/sidebar["']/u;
const SIDEBAR_FROM_BARREL = /import\s*\{[^}]*\bSidebar\b[^}]*\}\s*from\s+["']@elmeragroup\/fuse["']/u;

describe("docs chrome never composes the library Sidebar", () => {
  it("imports @elmeragroup/fuse/sidebar in no MDX page outside the Sidebar page", () => {
    const offenders = docsSourceFiles(path.join(docsRoot, "src"))
      .filter((file) => !isSidebarPage(file))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return SIDEBAR_IMPORT.test(source) || SIDEBAR_FROM_BARREL.test(source);
      })
      .map((file) => path.relative(docsRoot, file));
    expect(offenders).toEqual([]);
  });
});
