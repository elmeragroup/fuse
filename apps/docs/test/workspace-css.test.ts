import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { uiRoot } from "../scripts/lib/paths.ts";
import { assertDocsUiCssExports, DOCS_UI_DIST_CSS } from "../scripts/lib/workspace-css.ts";

function fixtureRoot(writeTargets: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "docs-workspace-css-"));
  if (writeTargets) {
    mkdirSync(join(root, "dist"), { recursive: true });
    for (const { relative } of DOCS_UI_DIST_CSS) {
      writeFileSync(join(root, relative), ":root{}\n");
    }
  }
  return root;
}

describe("assertDocsUiCssExports", () => {
  it("fails when a generated CSS file is missing", () => {
    expect(() => assertDocsUiCssExports(fixtureRoot(false))).toThrow(/pnpm --filter @elmeragroup\/ui build/);
  });

  it("returns the resolved files when they exist", () => {
    const root = fixtureRoot(true);
    expect(assertDocsUiCssExports(root)).toEqual(DOCS_UI_DIST_CSS.map(({ relative }) => join(root, relative)));
  });

  it("accepts the workspace UI package after it has been built", () => {
    expect(assertDocsUiCssExports(uiRoot)).toEqual(DOCS_UI_DIST_CSS.map(({ relative }) => join(uiRoot, relative)));
  });
});
