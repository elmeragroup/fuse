import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

const updates = asRecordArray(
  asRecord(parse(readFileSync(join(repoRoot, ".github", "dependabot.yml"), "utf8")), "dependabot.yml")
    .updates,
  "dependabot updates"
);

/**
 * The single update entry for an ecosystem.
 * @param {string} ecosystem
 */
function ecosystemEntry(ecosystem) {
  const matches = updates.filter((entry) => entry["package-ecosystem"] === ecosystem);
  expect(matches, `expected one ${ecosystem} entry`).toHaveLength(1);
  return matches[0];
}

describe("dependabot", () => {
  it("raises npm security updates only, without the no-changeset label", () => {
    const npm = ecosystemEntry("npm");
    expect(npm.directory).toBe("/");
    expect(npm["open-pull-requests-limit"]).toBe(0);
    // A fix to an exact-pinned published dependency reaches consumers only through a changeset.
    expect(npm.labels).toBeUndefined();
  });

  it("keeps the actions entry on its cooldown and no-changeset label", () => {
    const actions = ecosystemEntry("github-actions");
    expect(actions.labels).toEqual(["no-changeset"]);
    expect(actions.cooldown).toEqual({ "default-days": 3 });
  });
});
