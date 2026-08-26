import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { uiRoot } from "../scripts/lib/paths.ts";
import {
  assertCssExportTarget,
  assertDocsUiCssExports,
  DOCS_UI_DIST_CSS_EXPORTS,
} from "../scripts/lib/workspace-css.ts";

function fixturePackage(exports: Record<string, string>, writeTargets: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "docs-workspace-css-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@elmeragroup/ui", exports }));
  if (writeTargets) {
    mkdirSync(join(root, "dist"), { recursive: true });
    for (const target of Object.values(exports)) {
      writeFileSync(join(root, target), ":root{}\n");
    }
  }
  return root;
}

describe("assertCssExportTarget", () => {
  it("fails when the exported themes.css file is missing", () => {
    const root = fixturePackage({ "./themes.css": "./dist/themes.css" }, false);
    expect(() => assertCssExportTarget(root, "./themes.css")).toThrow(/pnpm --filter @elmeragroup\/ui build/);
  });

  it("returns the resolved file when the export target exists", () => {
    const root = fixturePackage({ "./themes.css": "./dist/themes.css" }, true);
    expect(assertCssExportTarget(root, "./themes.css")).toBe(join(root, "dist/themes.css"));
  });

  it("accepts the workspace UI package after it has been built", () => {
    expect(assertDocsUiCssExports(uiRoot)).toEqual(
      DOCS_UI_DIST_CSS_EXPORTS.map((key) => expect.stringMatching(new RegExp(`${key.slice(2)}$`)))
    );
  });
});
