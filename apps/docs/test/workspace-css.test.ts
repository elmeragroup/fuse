import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fuseRoot } from "../scripts/lib/paths.ts";
import { assertDocsFuseCssExports } from "../scripts/lib/workspace-css.ts";

describe("assertDocsFuseCssExports", () => {
  it("fails when a generated CSS file is missing", () => {
    using root = mkdtempDisposableSync(join(tmpdir(), "docs-workspace-css-"));
    expect(() => assertDocsFuseCssExports(root.path)).toThrow(/pnpm --filter @elmeragroup\/fuse build/);
  });

  it("accepts the workspace UI package after it has been built", () => {
    expect(assertDocsFuseCssExports(fuseRoot)).toEqual([
      join(fuseRoot, "dist/themes.css"),
      join(fuseRoot, "dist/demo-stage-density.css"),
    ]);
  });
});
