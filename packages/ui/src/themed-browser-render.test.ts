import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsRoot = join(dirname(fileURLToPath(import.meta.url)), "components");

const HARNESSED_SUITES = [
  "badge",
  "button",
  "card",
  "dialog",
  "scroll-area",
  "separator",
  "field",
  "item",
  "input",
  "input-group",
  "textarea",
] as const;

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

describe("themed browser-test harness", () => {
  it("is the only ThemeScope / density / CONTROL_MD surface the component suites use", () => {
    const files = HARNESSED_SUITES.flatMap((name) => walk(join(componentsRoot, name)));
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
});
