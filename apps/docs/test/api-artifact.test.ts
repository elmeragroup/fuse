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

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { STALE_HINT } from "../scripts/lib/api-artifact.ts";
import { componentSlugs, resolveComponentPaths } from "../scripts/lib/components.ts";
import { componentInspections, docsApiInventory } from "../scripts/lib/docs-inspection.ts";
import { repoRelative } from "../scripts/lib/paths.ts";
import { API_ARTIFACTS_REWRITTEN } from "../src/generated/api-drift";
import { API_REGEN_COMMAND } from "../src/lib/docs-model.ts";
import { ALIAS_PAGES } from "./component-inventory";

describe("committed api.json", () => {
  it("was already up to date when the last generation pass ran", () => {
    expect(
      API_ARTIFACTS_REWRITTEN,
      `The committed api.json of ${API_ARTIFACTS_REWRITTEN.join(", ")} did not match packages/fuse. ${STALE_HINT}`
    ).toEqual([]);
  });

  it("tells a reader in the file that it is generated, and how to regenerate it", () => {
    for (const slug of componentSlugs().filter((candidate) => !ALIAS_PAGES.has(candidate))) {
      for (const { apiFile } of resolveComponentPaths(slug).apis) {
        const text = readFileSync(apiFile, "utf8");
        expect(text, apiFile).toContain('"$generated"');
        expect(text, apiFile).toContain(API_REGEN_COMMAND);
        expect(text, apiFile).toContain("never hand-edit");
      }
    }
  });

  it("checks CommandVirtual, an entry with no page, through an artifact beside the Command page's", () => {
    // Unit under test: the inventory generation extracts and records drift for. Oracle: the
    // `@elmeragroup/fuse/command-virtual` facade, packages/fuse/src/command-virtual.ts, which
    // exports `CommandVirtual` and has no docs page; the Command page documents it.
    const row = docsApiInventory(componentInspections()).find(({ slug }) => slug === "command-virtual");
    expect(
      row && {
        ...row,
        entryFile: repoRelative(row.entryFile),
        apiEntryFile: repoRelative(row.apiEntryFile),
        apiFile: repoRelative(row.apiFile),
      }
    ).toEqual({
      slug: "command-virtual",
      page: "command",
      entry: "@elmeragroup/fuse/command-virtual",
      entryFile: "packages/fuse/src/command-virtual.ts",
      apiEntryFile: "packages/fuse/src/command-virtual.ts",
      exportNames: ["CommandVirtual"],
      apiFile: "apps/docs/src/app/(docs)/components/command/command-virtual.api.json",
    });
    const committed: unknown = JSON.parse(
      readFileSync("src/app/(docs)/components/command/command-virtual.api.json", "utf8")
    );
    expect(committed).toMatchObject({ slug: "command-virtual" });
  });

  it("writes none for a page that repeats another page whole", () => {
    for (const slug of ALIAS_PAGES)
      expect(existsSync(resolveComponentPaths(slug).apis[0].apiFile), slug).toBe(false);
  });
});
