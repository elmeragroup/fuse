import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fuseRoot } from "../scripts/lib/paths.ts";
import { assertDocsFuseCssExports } from "../scripts/lib/workspace-css.ts";

function fixtureRoot(writeTargets: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "docs-workspace-css-"));
  if (writeTargets) {
    mkdirSync(join(root, "dist"), { recursive: true });
    for (const relative of ["dist/themes.css", "dist/demo-stage-comfortable.css"]) {
      writeFileSync(join(root, relative), ":root{}\n");
    }
  }
  return root;
}

describe("assertDocsFuseCssExports", () => {
  it("fails when a generated CSS file is missing", () => {
    expect(() => assertDocsFuseCssExports(fixtureRoot(false))).toThrow(
      /pnpm --filter @elmeragroup\/fuse build/
    );
  });

  it("returns the resolved files when they exist", () => {
    const root = fixtureRoot(true);
    expect(assertDocsFuseCssExports(root)).toEqual([
      join(root, "dist/themes.css"),
      join(root, "dist/demo-stage-comfortable.css"),
    ]);
  });

  it("accepts the workspace UI package after it has been built", () => {
    expect(assertDocsFuseCssExports(fuseRoot)).toEqual([
      join(fuseRoot, "dist/themes.css"),
      join(fuseRoot, "dist/demo-stage-comfortable.css"),
    ]);
  });
});
