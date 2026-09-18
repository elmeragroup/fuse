import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isScalar, isSeq, parseDocument } from "yaml";

import { asRecord, asString, isString } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

/**
 * A temporary exclusion's leading comment must say when the release-age guard admits its
 * version on its own (tooling.md §2); the captured group is that expiry.
 */
const temporaryExclusion = /^Temporary: .* ages past the guard on (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/;

const source = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8");
const document = parseDocument(source);
const workspace = asRecord(document.toJS(), "pnpm-workspace.yaml");

describe("minimumReleaseAgeExclude", () => {
  it("holds only catalog-paired versions or temporary exclusions that have not expired", () => {
    const catalog = asRecord(workspace.catalog, "catalog");
    const permanent = ["@elmeragroup/internal", "effect"].map(
      (name) => `${name}@${asString(catalog[name], `catalog.${name}`)}`
    );
    const exclusions = document.get("minimumReleaseAgeExclude", true);
    if (!isSeq(exclusions)) throw new Error("minimumReleaseAgeExclude is not a list");
    for (const node of exclusions.items) {
      if (!isScalar(node) || !isString(node.value)) {
        throw new Error("a minimumReleaseAgeExclude entry is not a string");
      }
      const entry = node.value;
      if (permanent.includes(entry)) continue;
      const comment =
        node.commentBefore ?? (node === exclusions.items[0] ? exclusions.commentBefore : undefined);
      const expiry = temporaryExclusion.exec(comment?.trim() ?? "")?.[1];
      expect(
        expiry !== undefined && Date.parse(expiry) > Date.now(),
        expiry === undefined
          ? `minimumReleaseAgeExclude entry ${entry} is neither catalog-paired nor carries a "Temporary: … ages past the guard on <ISO timestamp>" comment`
          : `minimumReleaseAgeExclude entry ${entry} expired on ${expiry}; delete the entry and the tooling.md §2 clause`
      ).toBe(true);
    }
  });
});
