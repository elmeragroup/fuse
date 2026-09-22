/**
 * The `api.json` drift check.
 *
 * `api.json` is generated *and* committed, so it can go stale: someone edits a JSDoc
 * comment or a prop's type in `packages/fuse` and the artifact next to the page still
 * describes the old API. This is the check that refuses to let that land, and it looks
 * at staleness from both sides:
 *
 *   • a `check`-mode regeneration must find every artifact in the working tree byte-equal
 *     to what it would write — it fails naming each stale file — which catches a
 *     hand-edit and a stale file in any run that has not just generated;
 *   • the last generation pass must have rewritten nothing, which catches the case where
 *     generation ran *first* (the `test` task depends on `build`) and quietly repaired the
 *     stale file before this test could see it.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { API_REGEN_COMMAND, generateDocsApiArtifacts, STALE_HINT } from "../scripts/lib/api-artifact.ts";
import { componentSlugs, resolveComponentPaths } from "../scripts/lib/components.ts";
import { API_ARTIFACTS_REWRITTEN } from "../src/generated/api-drift";

describe("committed api.json", () => {
  // The long timeout is the regeneration itself: the package opens a full TypeScript
  // program over packages/fuse and re-derives every component's API through the checker.
  it("matches a fresh regeneration from the library's types and JSDoc", { timeout: 180_000 }, async () => {
    const slugs = componentSlugs();
    expect(slugs.length).toBeGreaterThan(0);

    // Rejects with a `DocsGenerationError` naming each stale file and the regen command,
    // or any extraction problem — the same ones that fail the docs build, which a drift
    // run must not be the place they first go unnoticed.
    const regenerated = await generateDocsApiArtifacts("check");

    for (const slug of slugs) {
      const artifact = regenerated.artifacts.get(slug);
      expect(artifact, `${slug} was not regenerated`).toBeDefined();
      expect(artifact?.changed, `${slug}/api.json is stale. ${STALE_HINT}`).toBe(false);
      expect(readFileSync(resolveComponentPaths(slug).apiFile, "utf8"), slug).toBe(artifact?.text);
    }
    // The package accepts `unsupported-type-fallback` for documented shapes and reports
    // it; anything else it would have failed on. Keep the accepted set visible here.
    for (const entry of regenerated.diagnostics) {
      expect(entry.warning.code, `${entry.component}: ${entry.warning.message}`).toBe(
        "unsupported-type-fallback"
      );
    }
  });

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
