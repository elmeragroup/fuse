import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("merge workflow", () => {
  const yaml = readFileSync(join(repoRoot, ".github/workflows/merge.yml"), "utf8");

  it("runs oxfmt, turbo ci:checks, changeset presence, and Playwright Chromium", () => {
    expect(yaml).toContain("oxfmt --check");
    expect(yaml).toContain("turbo run ci:checks");
    expect(yaml).toContain("changeset status");
    expect(yaml).toContain("no-changeset");
    expect(yaml).toContain("playwright install --with-deps chromium");
  });

  it("runs the check suite on pull_request and on push to the default branch", () => {
    expect(yaml).toMatch(/^on:\n(?:  .*\n)*?  pull_request:/m);
    expect(yaml).toMatch(/^on:\n(?:  .*\n)*?  push:\n(?:    .*\n)*?      - main/m);
  });

  it("exempts Version-Packages PRs by changeset-release/* head branch without a label", () => {
    expect(yaml).toContain("changeset-release/");
    expect(yaml).toContain("startsWith(github.head_ref, 'changeset-release/')");
  });

  it("matches the no-changeset label by whole name, not a joined-string substring", () => {
    expect(yaml).not.toContain("join(github.event.pull_request.labels.*.name");
    expect(yaml).toContain("contains(github.event.pull_request.labels.*.name, 'no-changeset')");
    expect(yaml).not.toContain("foo-no-changeset-x");
  });

  it("still runs changeset status on an unlabeled pull_request", () => {
    expect(yaml).toContain("changeset status --since=");
    expect(yaml).toMatch(/if:[\s\S]*github\.event_name == 'pull_request'/);
  });

  it("opens a Version Packages PR from main without publishing", () => {
    const yaml = readFileSync(join(repoRoot, ".github/workflows/version-packages.yml"), "utf8");
    expect(yaml).toContain("changesets/action");
    expect(yaml).toContain("changeset version");
    expect(yaml).not.toContain("npm publish");
    expect(yaml).not.toContain("pnpm publish");
  });
});
