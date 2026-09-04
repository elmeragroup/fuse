import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Both test tiers: the base-ui components and the quarantined react-aria interim tier, which is
 * held to the same test standards (tooling §7.2, amended 2026-09-03).
 */
const suiteRoots = ["components", "react-aria"].map((tier) => join(sourceRoot, tier));

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (path.endsWith(".browser.test.tsx")) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Helpers whose local re-declaration is still being unwound, suite by suite, by the batch tickets
 * that adopt the shared exports. New copies are a failure; the recorded ones are a worklist.
 */
const MIGRATING_HELPERS = [
  { helper: "headingNamed", pattern: /function headingNamed\b/ },
  { helper: "cssVarColor", pattern: /function cssVarColor\b/ },
  { helper: "roleNamed", pattern: /function roleNamed\b/ },
] as const;

const KNOWN_LOCAL_HELPER_COPIES = [
  "components/alert/alert.browser.test.tsx headingNamed",
  "components/checkbox-card/checkbox-card.browser.test.tsx cssVarColor",
  "components/checkbox/checkbox.browser.test.tsx cssVarColor",
  "components/checkbox/checkbox.browser.test.tsx headingNamed",
  "components/description-list/description-list.browser.test.tsx headingNamed",
  "components/heading/heading.browser.test.tsx headingNamed",
  "components/radio-group/radio-group.browser.test.tsx cssVarColor",
  "components/radio-group/radio-group.browser.test.tsx headingNamed",
  "components/timeline-list/timeline-list.browser.test.tsx headingNamed",
];

describe("themed browser-test harness", () => {
  it("is the only ThemeScope / density / CONTROL_MD surface the component and react-aria suites use", () => {
    const files = suiteRoots.flatMap((root) => walk(root));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("themed-browser-render");
      expect(source, file).not.toContain("theme-browser-fixtures");
      expect(source, file).not.toMatch(/const fkasPrivate\s*=/);
      expect(source, file).not.toMatch(/function stampDensity\b/);
      expect(source, file).not.toMatch(/function px\(/);
      expect(source, file).not.toMatch(/function textboxNamed\b/);
    }
  });

  it("grows no new local copy of roleNamed / headingNamed / cssVarColor", () => {
    const findings = suiteRoots
      .flatMap((root) => walk(root))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const path = relative(sourceRoot, file);
        return MIGRATING_HELPERS.filter(({ pattern }) => pattern.test(source)).map(
          ({ helper }) => `${path} ${helper}`
        );
      })
      .sort();

    // Subset, not equality: the batch tickets delete these copies without editing this list.
    expect(findings.filter((finding) => !KNOWN_LOCAL_HELPER_COPIES.includes(finding))).toEqual([]);
  });

  it("records that the react-aria tier already has no local helper copies", () => {
    expect(KNOWN_LOCAL_HELPER_COPIES.filter((finding) => finding.startsWith("react-aria/"))).toEqual([]);
  });

  it("locates emoji…popover-info-button browser suites by role, not unsanctioned data-slot/querySelector", () => {
    const epDirs = new Set([
      "emoji",
      "empty",
      "field",
      "frame",
      "heading",
      "input",
      "input-group",
      "item",
      "loader",
      "meter",
      "number-field",
      "pagination",
      "phone-number-field",
      "popover",
      "popover-info-button",
    ]);
    const slotAuditDirs = new Set(["emoji", "empty", "frame", "meter", "pagination"]);
    const locator = /\.querySelector(All)?\s*\(|\.closest\(\s*["'`][^"'`]*data-slot|dataset\.slot\b/;

    const files = suiteRoots
      .flatMap((root) => walk(root))
      .filter((file) => {
        const path = relative(sourceRoot, file);
        const dir = path.split("/")[1];
        return path.startsWith("components/") && dir !== undefined && epDirs.has(dir);
      });
    expect(files.length).toBeGreaterThan(0);

    const unsanctioned: string[] = [];
    for (const file of files) {
      const path = relative(sourceRoot, file);
      const dir = path.split("/")[1] ?? "";
      const lines = readFileSync(file, "utf8").split("\n");
      for (const [index, line] of lines.entries()) {
        if (!locator.test(line) || /^\s*(\/\/|\*)/.test(line)) {
          continue;
        }
        const cited = lines
          .slice(Math.max(0, index - 16), index + 1)
          .some((candidate) => /§9/.test(candidate) && /(\/\/|\*|\/\*)/.test(candidate));
        if (slotAuditDirs.has(dir) && cited) {
          continue;
        }
        unsanctioned.push(`${path}:${index + 1}`);
      }
    }
    expect(unsanctioned).toEqual([]);
  });
});
