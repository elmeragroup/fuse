import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Both test tiers — the base-ui components and the quarantined react-aria interim tier, which is
 * held to the same test standards (tooling §7.2, amended 2026-09-03) — plus the package-private
 * hooks, whose browser suites mount real controls and are held to the same shape.
 */
const suiteRoots = ["components", "react-aria", "hooks"].map((tier) => join(sourceRoot, tier));
const hooksRoot = join(sourceRoot, "hooks");

/**
 * Shared browser fixtures live outside `src`, so the suite-shape gates below do not apply to
 * them — but a locator extracted into one is the same locator it was in the suite, and would
 * otherwise leave the gate the moment it moved (tooling §8).
 */
const sharedFixtureRoot = join(sourceRoot, "../test");

function walk(directory: string, matches: (path: string) => boolean): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path, matches));
      continue;
    }
    if (matches(path)) {
      files.push(path);
    }
  }
  return files;
}

function readAll(files: readonly string[]): [string, string][] {
  return files.map((file) => [file, readFileSync(file, "utf8")]);
}

const suiteFiles = suiteRoots.flatMap((root) => walk(root, (path) => path.endsWith(".browser.test.tsx")));
const suiteSources = new Map(readAll(suiteFiles));

const fixtureFiles = walk(sharedFixtureRoot, (path) => path.endsWith(".ts") || path.endsWith(".tsx"));
const locatorSources = new Map([...suiteSources, ...readAll(fixtureFiles)]);

const DOM_AUDIT_COMMENT = /(?:\/\/|\/\*\*?|^\s*\*)\s*DOM audit:\s*\w/;
const DOCUMENT_QUERY = /\bdocument(?:\.(?:body|head|documentElement))?\.querySelector(?:All)?\s*\(/;
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

function isDocumentedDomAudit(lines: string[], index: number): boolean {
  const windowStart = Math.max(0, index - 16);
  return lines.slice(windowStart, index + 1).some((line) => DOM_AUDIT_COMMENT.test(line));
}

function unsanctionedSlotLocators(): string[] {
  const findings: string[] = [];
  for (const [file, source] of locatorSources) {
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      if (!isSlotOrDocumentLocator(line) || isDocumentedDomAudit(lines, index)) {
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
      // Every suite mounts through the shared harness; a hook probe has no theme to scope, so
      // the hooks tier may take `render` from `test/browser-render` directly.
      expect(source, file).toMatch(
        file.startsWith(hooksRoot) ? /test\/(?:themed-)?browser-render/ : /themed-browser-render/
      );
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

  it("requires an explained DOM audit comment within the query window", () => {
    const query = 'document.querySelector("[data-slot=card]")';
    expect(isDocumentedDomAudit(["// DOM audit: all card parts expose their slots.", query], 1)).toBe(true);
    expect(isDocumentedDomAudit([query + " // DOM audit: the card slot is public."], 0)).toBe(true);
    expect(isDocumentedDomAudit(["/** DOM audit: each card part exposes a slot. */", query], 1)).toBe(true);
    expect(isDocumentedDomAudit(["// DOM audit:", query], 1)).toBe(false);
    expect(isDocumentedDomAudit(['const note = "DOM audit: card";', query], 1)).toBe(false);
    expect(isDocumentedDomAudit(["// Unrelated comment", query], 1)).toBe(false);
    const lines = ["// DOM audit: all card parts expose their slots.", ...Array<string>(16).fill("")];
    expect(isDocumentedDomAudit(lines, 16)).toBe(true);
    expect(isDocumentedDomAudit([...lines, query], 17)).toBe(false);
  });

  it("classifies document-root querySelector calls as locators", () => {
    expect(isSlotOrDocumentLocator('document.querySelector("[data-slot=card]")')).toBe(true);
    expect(isSlotOrDocumentLocator('document.querySelectorAll("[data-slot=card]")')).toBe(true);
    expect(isSlotOrDocumentLocator('document.body.querySelector(`input[aria-label="${name}"]`)')).toBe(true);
    expect(isSlotOrDocumentLocator('document.head.querySelectorAll("[data-scroll-area-test-styles]")')).toBe(
      true
    );
    expect(isSlotOrDocumentLocator('document.documentElement.querySelector("style")')).toBe(true);
    expect(isSlotOrDocumentLocator('document.documentElement.querySelectorAll("style")')).toBe(true);
    expect(isSlotOrDocumentLocator('// document.body.querySelector("x")')).toBe(false);
  });

  it("locates by role except documented DOM contract checks", () => {
    // The shared fixtures under test/ are in this gate even though they are in neither suite root.
    expect(fixtureFiles.length).toBeGreaterThan(0);
    expect(unsanctionedSlotLocators()).toEqual([]);
  });
});
