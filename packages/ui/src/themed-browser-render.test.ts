import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Both test tiers: the base-ui components and the quarantined react-aria interim tier, which is
 * held to the same test standards (tooling §7.2, amended 2026-09-03).
 */
const suiteRoots = ["components"].map((tier) => join(sourceRoot, tier));

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

const suiteFiles = suiteRoots.flatMap((root) => walk(root));
const suiteSources = new Map(suiteFiles.map((file) => [file, readFileSync(file, "utf8")]));

const SLOT_AUDIT_CITE = /§9/;
const DOCUMENT_QUERY = /\bdocument\.querySelector(?:All)?\s*\(/;
const SLOT_QUERY = /(?:querySelector(?:All)?|closest)\s*\(\s*(['"`])[^'"`]*data-slot/;
const STAR_QUERY = /querySelectorAll\(\s*(['"`])\*\1\s*\)/;
const BY_SLOT = /function bySlot\b/;
const DATASET_SLOT = /dataset\.slot\b/;

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

function isSlotOrDocumentLocator(line: string): boolean {
  if (isCommentLine(line)) {
    return false;
  }
  return (
    DOCUMENT_QUERY.test(line) ||
    SLOT_QUERY.test(line) ||
    STAR_QUERY.test(line) ||
    BY_SLOT.test(line) ||
    DATASET_SLOT.test(line)
  );
}

function isCitedSlotAudit(lines: string[], index: number): boolean {
  const windowStart = Math.max(0, index - 16);
  return lines.slice(windowStart, index + 1).some((line) => SLOT_AUDIT_CITE.test(line));
}

function unsanctionedSlotLocators(): string[] {
  const findings: string[] = [];
  for (const [file, source] of suiteSources) {
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      if (!isSlotOrDocumentLocator(line) || isCitedSlotAudit(lines, index)) {
        continue;
      }
      findings.push(`${relative(sourceRoot, file)}:${index + 1}`);
    }
  }
  return findings;
}

describe("themed browser-test harness", () => {
  it("is the only ThemeScope / density / CONTROL_MD surface the component and react-aria suites use", () => {
    expect(suiteFiles.length).toBeGreaterThan(0);

    for (const file of suiteFiles) {
      const source = suiteSources.get(file) ?? "";
      expect(source, file).toContain("themed-browser-render");
      expect(source, file).not.toContain("theme-browser-fixtures");
      expect(source, file).not.toMatch(/const fkasPrivate\s*=/);
    }
  });

  it("browser suites do not wait with setTimeout", () => {
    const findings = suiteFiles.flatMap((file) => {
      const path = relative(sourceRoot, file);
      return (suiteSources.get(file) ?? "")
        .split("\n")
        .flatMap((line, index) => (/setTimeout\s*\(/.test(line) ? [`${path}:${String(index + 1)}`] : []));
    });
    expect(findings).toEqual([]);
  });

  it("locates by role except cited §9 slot audits and document-root queries", () => {
    expect(unsanctionedSlotLocators()).toEqual([]);
  });
});
