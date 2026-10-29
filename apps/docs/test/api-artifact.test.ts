/**
 * The `api.json` drift check.
 *
 * `api.json` is generated *and* committed, so it can go stale: someone edits a JSDoc
 * comment or a prop's type in `packages/fuse` and the artifact next to the page still
 * describes the old API. This is the check that refuses to let that land.
 *
 * The `test` task depends on `build`, which depends on `generate`, and the committed
 * `api.json` files are among `generate`'s inputs. So a Fuse change or a hand-edit always
 * reruns generation before this suite, and generation repairs the stale file and records it
 * in `API_ARTIFACTS_REWRITTEN`, which this suite reads. Generation also fails on every
 * extraction problem but `unsupported-type-fallback`. A run that skips the task graph, such
 * as Vitest alone after a Fuse edit, reads the last generation's record; `pnpm --filter docs
 * generate` refreshes it.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { STALE_HINT } from "../scripts/lib/api-artifact.ts";
import { componentSlugs, resolveComponentPaths } from "../scripts/lib/components.ts";
import { API_ARTIFACTS_REWRITTEN } from "../src/generated/api-drift";
import { API_REGEN_COMMAND } from "../src/lib/docs-model.ts";

describe("committed api.json", () => {
  it("was already up to date when the last generation pass ran", () => {
    expect(
      API_ARTIFACTS_REWRITTEN,
      `The committed api.json of ${API_ARTIFACTS_REWRITTEN.join(", ")} did not match packages/fuse. ${STALE_HINT}`
    ).toEqual([]);
  });

  it("tells a reader in the file that it is generated, and how to regenerate it", () => {
    for (const slug of componentSlugs()) {
      const text = readFileSync(resolveComponentPaths(slug).apiFile, "utf8");
      expect(text, slug).toContain('"$generated"');
      expect(text, slug).toContain(API_REGEN_COMMAND);
      expect(text, slug).toContain("never hand-edit");
    }
  });
});
