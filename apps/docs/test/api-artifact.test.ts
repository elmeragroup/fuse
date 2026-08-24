/**
 * The `api.json` drift check (docs-site.md §8).
 *
 * `api.json` is generated *and* committed, so it can go stale: someone edits a JSDoc
 * comment or a prop's type in `packages/ui` and the artifact next to the page still
 * describes the old API. This is the check that refuses to let that land, and it looks
 * at staleness from both sides:
 *
 *   • the artifacts in the working tree must equal a fresh in-memory regeneration, which
 *     catches a hand-edit and a stale file in any run that has not just generated;
 *   • the last generation pass must have rewritten nothing, which catches the case where
 *     generation ran *first* (the `test` task depends on `build`) and quietly repaired the
 *     stale file before this test could see it.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { API_REGEN_COMMAND, regenerateApiArtifacts } from "../scripts/lib/api-artifact.ts";
import { componentSlugs, resolveComponentPaths } from "../scripts/lib/components.ts";
import { repoRelative } from "../scripts/lib/paths.ts";
import { API_ARTIFACTS_REWRITTEN } from "../src/generated/api-drift";

const STALE = `Run \`${API_REGEN_COMMAND}\` and commit the updated api.json files.`;

describe("committed api.json", () => {
  // The long timeout is the regeneration itself: it opens a full TypeScript program over
  // packages/ui and re-derives every component's API through the checker.
  it("matches a fresh regeneration from the library's types and JSDoc", { timeout: 180_000 }, () => {
    const slugs = componentSlugs();
    expect(slugs.length).toBeGreaterThan(0);

    const regenerated = regenerateApiArtifacts();
    // The missing-JSDoc and unresolvable-type invariants are the same ones that fail the
    // docs build; a drift run must not be the place they first go unnoticed.
    expect(regenerated.problems).toEqual([]);

    for (const slug of slugs) {
      const file = resolveComponentPaths(slug).apiFile;
      const relative = repoRelative(file);
      expect(existsSync(file), `${relative} is missing. ${STALE}`).toBe(true);
      const expected = regenerated.texts.get(slug);
      expect(expected, `${slug} was not regenerated`).toBeDefined();
      expect(JSON.parse(readFileSync(file, "utf8")), `${relative} is stale. ${STALE}`).toEqual(
        JSON.parse(expected ?? "null")
      );
      // Byte-exact too: key order, indentation and the trailing newline are part of the
      // artifact, so a reviewer never reads a reordering as an API change.
      expect(readFileSync(file, "utf8"), `${relative} is stale. ${STALE}`).toBe(expected);
    }
  });

  it("was already up to date when the last generation pass ran", () => {
    expect(
      API_ARTIFACTS_REWRITTEN,
      `The committed api.json of ${API_ARTIFACTS_REWRITTEN.join(", ")} did not match packages/ui. ${STALE}`
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
