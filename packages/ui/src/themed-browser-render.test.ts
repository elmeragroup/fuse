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

const LOCAL_HELPER_PATTERNS = [
  { helper: "headingNamed", pattern: /function headingNamed\b/ },
  { helper: "cssVarColor", pattern: /function cssVarColor\b/ },
  { helper: "roleNamed", pattern: /function roleNamed\b/ },
] as const;

/** Empty worklist: a local `function roleNamed` / `headingNamed` / `cssVarColor` fails. */
const KNOWN_LOCAL_HELPER_COPIES: readonly string[] = [];

/**
 * Directory names under `src/components/` for the a–d batch (ticket 47). 48/49 add
 * sibling `it(...)` blocks with their own ranges; keep this list a–d only.
 */
const RANGE_A_D = [
  "accordion",
  "alert",
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "card",
  "checkbox",
  "checkbox-card",
  "code",
  "collapsible",
  "combobox",
  "confirm-button",
  "description-list",
  "dialog",
  "dropdown-menu",
] as const;

function componentBrowserSuites(names: readonly string[]): string[] {
  return names.flatMap((name) => walk(join(sourceRoot, "components", name)));
}

const SLOT_AUDIT_CITE = /§9/;
const DOCUMENT_QUERY = /\bdocument\.querySelector(?:All)?\s*\(/;
const SLOT_QUERY = /(?:querySelector(?:All)?|closest)\s*\(\s*(['"`])[^'"`]*data-slot/;
const SLOT_QUERY_TEMPLATE = /(?:querySelector(?:All)?|closest)\s*\(\s*`[^`]*data-slot/;
const STAR_QUERY = /querySelectorAll\(\s*(['"`])\*\1\s*\)/;

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

function isSlotOrDocumentLocator(line: string): boolean {
  if (isCommentLine(line)) {
    return false;
  }
  if (DOCUMENT_QUERY.test(line) || SLOT_QUERY.test(line) || SLOT_QUERY_TEMPLATE.test(line)) {
    return true;
  }
  return STAR_QUERY.test(line);
}

function isCitedSlotAudit(lines: string[], index: number): boolean {
  const windowStart = Math.max(0, index - 4);
  return lines.slice(windowStart, index + 1).some((line) => SLOT_AUDIT_CITE.test(line));
}

/** CSS/`data-slot` locators that are not a cited spec-§9 slot audit (tooling §7.2). */
function unsanctionedSlotLocators(files: string[]): string[] {
  const findings: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
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

function localHelperCopiesIn(source: string): string[] {
  return LOCAL_HELPER_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(({ helper }) => helper);
}

function helperCopyFindings(readSource: (file: string) => string): string[] {
  return suiteRoots
    .flatMap((root) => walk(root))
    .flatMap((file) => {
      const path = relative(sourceRoot, file);
      return localHelperCopiesIn(readSource(file)).map((helper) => `${path} ${helper}`);
    })
    .sort();
}

function extrasNotAllowlisted(findings: string[]): string[] {
  return findings.filter((finding) => !KNOWN_LOCAL_HELPER_COPIES.includes(finding));
}

const QZ_COMPONENTS = new Set([
  "radio-group",
  "scroll-area",
  "select",
  "selection-item",
  "separator",
  "sheet",
  "show",
  "sidebar",
  "skeleton",
  "span",
  "switch",
  "table",
  "tabs",
  "text",
  "text-field",
  "textarea",
  "textarea-field",
  "timeline-list",
  "toast",
  "toggle",
  "toggle-group",
  "tooltip",
]);

function isQzOrReactAria(relPath: string): boolean {
  if (relPath.startsWith("react-aria/")) {
    return true;
  }
  const match = /^components\/([^/]+)\//.exec(relPath);
  return match !== null && QZ_COMPONENTS.has(match[1] ?? "");
}

const QZ_SLOT_AUDIT_CITE = /spec §9/;

function lineCited(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (QZ_SLOT_AUDIT_CITE.test(line)) {
    return true;
  }
  for (let previous = index - 1; previous >= 0; previous--) {
    const text = (lines[previous] ?? "").trim();
    if (text === "" || text.startsWith("//") || text.startsWith("*") || text.startsWith("/*")) {
      if (QZ_SLOT_AUDIT_CITE.test(lines[previous] ?? "")) {
        return true;
      }
      continue;
    }
    break;
  }
  return false;
}

const UNSANCTIONED_LOCATOR =
  /querySelector(?:All)?\s*\(\s*[`'"][^`'"]*data-slot|closest\(\s*[`'"][^`'"]*data-slot|function bySlot\b/;

function unsanctionedLocators(source: string, path: string): string[] {
  const lines = source.split("\n");
  const findings: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (!UNSANCTIONED_LOCATOR.test(line) || lineCited(lines, index)) {
      continue;
    }
    findings.push(`${path}:${String(index + 1)}`);
  }
  return findings;
}

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

  it("forbids a local copy of roleNamed / headingNamed / cssVarColor", () => {
    expect(helperCopyFindings((file) => readFileSync(file, "utf8"))).toEqual([]);
  });

  it("fails a planted local function roleNamed", () => {
    const files = suiteRoots.flatMap((root) => walk(root));
    const target = files.find(
      (file) => relative(sourceRoot, file) === "components/show/show.browser.test.tsx"
    );
    if (target === undefined) {
      throw new Error("expected show.browser.test.tsx in the walked suite roots");
    }
    const extras = extrasNotAllowlisted(
      helperCopyFindings((file) => {
        const source = readFileSync(file, "utf8");
        return file === target ? `${source}\nfunction roleNamed() {}` : source;
      })
    );
    expect(extras).toEqual([`${relative(sourceRoot, target)} roleNamed`]);
    expect(localHelperCopiesIn("const roleNamed = () => undefined;")).toEqual([]);
  });

  it("records that the react-aria tier has no local helper copies", () => {
    const findings = suiteRoots
      .flatMap((root) => walk(root))
      .flatMap((file) => {
        const path = relative(sourceRoot, file);
        if (!path.startsWith("react-aria/")) {
          return [];
        }
        return localHelperCopiesIn(readFileSync(file, "utf8")).map((helper) => `${path} ${helper}`);
      });
    expect(findings).toEqual([]);
  });

  it("browser suites do not wait with setTimeout", () => {
    const findings = suiteRoots.flatMap((root) =>
      walk(root).flatMap((file) => {
        const path = relative(sourceRoot, file);
        return readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) => (/setTimeout\s*\(/.test(line) ? [`${path}:${String(index + 1)}`] : []));
      })
    );
    expect(findings).toEqual([]);
  });

  it("q-z and react-aria suites locate by role, not querySelector/data-slot, except cited slot audits", () => {
    const findings = suiteRoots
      .flatMap((root) => walk(root))
      .flatMap((file) => {
        const path = relative(sourceRoot, file);
        if (!isQzOrReactAria(path)) {
          return [];
        }
        return unsanctionedLocators(readFileSync(file, "utf8"), path);
      });
    expect(findings).toEqual([]);
  });

  it("a-d browser suites locate by role/label except cited §9 slot audits", () => {
    const files = componentBrowserSuites(RANGE_A_D);
    expect(files.length).toBeGreaterThan(0);
    expect(unsanctionedSlotLocators(files)).toEqual([]);
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
    const slotAuditDirs = new Set(["emoji", "frame", "meter", "pagination"]);
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
