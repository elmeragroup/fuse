import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const workspaceRoot = join(docsRoot, "../..");
const specPath = join(workspaceRoot, "docs/spec/docs-site.md");

function collectFiles(directory: string, prefix: string, suffix: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") {
        continue;
      }
      files.push(...collectFiles(join(directory, entry.name), relative, suffix));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(relative);
    }
  }
  return files;
}

function srcCssFiles(): string[] {
  return collectFiles(join(docsRoot, "src"), "src", ".css").sort();
}

function srcTsFiles(): string[] {
  return [
    ...collectFiles(join(docsRoot, "src"), "src", ".ts"),
    ...collectFiles(join(docsRoot, "src"), "src", ".tsx"),
  ].sort();
}

const EXPORTED_CLASS_NAME = /export\s+(?:const|function|type|class)\s+\w*ClassName\b/;
const EXPORTED_TV_RECIPE = /export\s+const\s+\w+\s*=\s*tv\s*\(/;

describe("docs Tailwind migration contract", () => {
  it("keeps globals.css as the Tailwind entry with DemoStage as the density hook", () => {
    const globals = readFileSync(join(docsRoot, "src/styles/globals.css"), "utf8");
    expect(globals).toContain('@import "tailwindcss";');
    expect(globals).toContain('@import "@elmeragroup/ui/css";');
    expect(globals).toContain('@import "@elmeragroup/ui/themes.css";');
    expect(globals).toContain('@import "@elmeragroup/ui/demo-stage-comfortable.css";');
    expect(globals).toContain('@source "../../../../packages/ui/src";');
    expect(globals).toContain('@source "../../src";');
    expect(globals).not.toContain("@apply");
    expect(globals).not.toMatch(/--control-/);

    const demoStage = readFileSync(join(docsRoot, "src/components/demo-stage.tsx"), "utf8");
    expect(demoStage).toContain('"DemoStage ');
  });

  it("registers the Typography plugin and a docs prose theme after the Tailwind import", () => {
    const globals = readFileSync(join(docsRoot, "src/styles/globals.css"), "utf8");
    const tailwindImport = globals.indexOf('@import "tailwindcss";');
    const plugin = globals.indexOf('@plugin "@tailwindcss/typography";');
    const utility = globals.search(/@utility\s+prose-docs\b/);

    expect(tailwindImport).toBeGreaterThan(-1);
    expect(plugin).toBeGreaterThan(tailwindImport);
    expect(utility).toBeGreaterThan(plugin);
    expect(globals).toContain("--tw-prose-");
    expect(globals).toContain("--font-docs-mono");
  });

  it("owns exactly one stylesheet under src", () => {
    expect(srcCssFiles()).toEqual(["src/styles/globals.css"]);
  });

  it("depends on tailwind-variants and the Typography plugin through the workspace catalog", () => {
    // SAFETY: package.json is a JSON object with string-valued dependency maps; we only
    // read the two catalog specifiers this contract names.
    const pkg = JSON.parse(readFileSync(join(docsRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const catalog = readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8");

    expect(pkg.dependencies?.["tailwind-variants"]).toBe("catalog:");
    expect(pkg.devDependencies?.["@tailwindcss/typography"]).toBe("catalog:");
    expect(catalog).toMatch(/tailwind-variants:\s*3\.3\.1/);
    expect(catalog).toMatch(/["']@tailwindcss\/typography["']:\s*0\.5\.20/);
  });

  it("does not keep a shared class-name module or exported class-name constants", () => {
    expect(existsSync(join(docsRoot, "src/components/docs-styles.ts"))).toBe(false);

    const exported = srcTsFiles().flatMap((relative) => {
      const source = readFileSync(join(docsRoot, relative), "utf8");
      const hits: string[] = [];
      if (EXPORTED_CLASS_NAME.test(source)) {
        hits.push(`${relative}: exported ClassName`);
      }
      if (EXPORTED_TV_RECIPE.test(source)) {
        hits.push(`${relative}: exported tv recipe`);
      }
      return hits;
    });

    expect(exported).toEqual([]);
  });

  it("inlines complete utility literals in private tv recipes", () => {
    const offenders = srcTsFiles()
      .filter((relative) => relative.startsWith("src/components/"))
      .flatMap((relative) => {
        const source = readFileSync(join(docsRoot, relative), "utf8");
        if (!/\btv\s*\(/.test(source)) {
          return [];
        }
        return [...source.matchAll(/\$\{(\w+)\}/g)].map((match) => `${relative}: \${${match[1]}}`);
      });

    expect(offenders).toEqual([]);

    const apiRows = readFileSync(join(docsRoot, "src/components/api-rows.tsx"), "utf8");
    expect(apiRows).not.toMatch(/\bconst api[A-Z]\w*\s*=\s*["'`]/);
  });

  it("lets the docs-site spec permit Typography, private tv recipes, and component-owned contracts", () => {
    const spec = readFileSync(specPath, "utf8");
    const start = spec.indexOf("- **Styling**");
    const end = spec.indexOf("\n\n## 2 ");
    const styling = spec.slice(start, end);

    expect(styling).toContain('@plugin "@tailwindcss/typography"');
    expect(styling).toContain("prose-docs");
    expect(styling).toMatch(/private(?: docs)? `tv` recipes/);
    expect(styling).toContain("React components");
    expect(styling).toContain("@apply");
    expect(styling).toContain("exported class-name constants");
    expect(styling).not.toContain("docs-styles.ts");
  });
});

const VAR_CALL = /var\(\s*(--[A-Za-z0-9_-]+)([^)]*)\)/g;

function definedCustomProperties(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/(?:^|[\s;{])(--[A-Za-z0-9_-]+)\s*:/gm)) {
    names.add(match[1] ?? "");
  }
  names.delete("");
  return names;
}

function componentVarFailures(source: string, defined: Set<string>): string[] {
  const failures: string[] = [];
  VAR_CALL.lastIndex = 0;
  for (const match of source.matchAll(VAR_CALL)) {
    const name = match[1] ?? "";
    const rest = match[2] ?? "";
    if (defined.has(name) || rest.includes(",")) {
      continue;
    }
    failures.push(name);
  }
  return failures;
}

describe("docs component CSS variables", () => {
  it("references only defined custom properties", () => {
    const globals = readFileSync(join(docsRoot, "src/styles/globals.css"), "utf8");
    const uiCss = readFileSync(join(workspaceRoot, "packages/ui/src/styles/ui.css"), "utf8");
    const themesCss = readFileSync(
      join(workspaceRoot, "packages/ui/src/theme/__snapshots__/themes.css"),
      "utf8"
    );
    const defined = new Set([
      ...definedCustomProperties(globals),
      ...definedCustomProperties(uiCss),
      ...definedCustomProperties(themesCss),
    ]);

    const failures = srcTsFiles()
      .filter((relative) => relative.startsWith("src/components/"))
      .flatMap((relative) => {
        const source = readFileSync(join(docsRoot, relative), "utf8");
        for (const match of source.matchAll(/\[(--[A-Za-z0-9_-]+):/g)) {
          defined.add(match[1] ?? "");
        }
        return componentVarFailures(source, defined).map((name) => `${relative}: ${name}`);
      });

    expect(failures, failures.join("\n")).toEqual([]);
    expect(
      srcTsFiles().some((relative) => readFileSync(join(docsRoot, relative), "utf8").includes("--docs-ink"))
    ).toBe(false);
  });
});
