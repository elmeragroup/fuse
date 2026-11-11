import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

// The TypeScript side of this contract is lint: the `fuse/restricted-imports` overrides for
// apps/docs/src in `oxlint.config.ts` ban the library Sidebar outside the globs listed there.
// Oxlint does not read MDX, so this file holds the MDX side: only the Sidebar page's MDX imports it.
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

/** The Sidebar component page, the one MDX page that demonstrates the library Sidebar. */
const SIDEBAR_ROUTE = "src/app/(docs)/components/sidebar/";

const SIDEBAR_IMPORT = /from\s+["']@elmeragroup\/fuse\/sidebar["']/u;
const SIDEBAR_FROM_BARREL = /import\s*\{[^}]*\bSidebar\b[^}]*\}\s*from\s+["']@elmeragroup\/fuse["']/u;

describe("docs chrome never composes the library Sidebar", () => {
  it("imports @elmeragroup/fuse/sidebar in no MDX page outside the Sidebar page", () => {
    const offenders = docsSourceFiles(path.join(docsRoot, "src"))
      .filter((file) => !path.relative(docsRoot, file).split(path.sep).join("/").startsWith(SIDEBAR_ROUTE))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return SIDEBAR_IMPORT.test(source) || SIDEBAR_FROM_BARREL.test(source);
      })
      .map((file) => path.relative(docsRoot, file));
    expect(offenders).toEqual([]);
  });
});
