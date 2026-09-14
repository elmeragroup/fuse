import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node } from "typescript/unstable/ast";
import {
  isCallExpression,
  isIdentifier,
  isStringLiteral,
  isTemplateExpression,
} from "typescript/unstable/ast/is";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const workspaceRoot = join(docsRoot, "../..");

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

/** Parse only the supplied sources; no library project or type checking is needed. */
function recipeSlotFailures(sources: readonly { file: string; source: string }[]): string[] {
  const root = "/docs-recipe-check";
  const config = `${root}/tsconfig.json`;
  const inputs = sources.map((entry, index) => ({ ...entry, virtualFile: `${root}/${String(index)}.tsx` }));
  const api = new API({
    cwd: root,
    fs: createVirtualFileSystem({
      [config]: JSON.stringify({
        compilerOptions: { noLib: true, noResolve: true },
        files: inputs.map(({ virtualFile }) => virtualFile),
      }),
      ...Object.fromEntries(inputs.map(({ source, virtualFile }) => [virtualFile, source])),
    }),
  });
  try {
    const project = api.updateSnapshot({ openProjects: [config] }).getProject(config);
    if (project === undefined) throw new Error("Could not open recipe syntax project");
    return inputs.flatMap(({ file, source, virtualFile }) => {
      const parsed = project.program.getSourceFile(virtualFile);
      if (parsed === undefined) throw new Error(`Could not parse ${file}`);
      const failures: string[] = [];
      function inspectRecipe(node: Node): void {
        if (isTemplateExpression(node)) failures.push(`${file}: ${source.slice(node.pos, node.end).trim()}`);
        // A slot string carries utilities only; a leading PascalCase token is a marker class name.
        if (isStringLiteral(node) && /^[A-Z][a-z]/.test(node.text))
          failures.push(`${file}: marker class ${node.text}`);
        node.forEachChild(inspectRecipe);
      }
      function visit(node: Node): void {
        if (isCallExpression(node) && isIdentifier(node.expression) && node.expression.text === "tv") {
          for (const argument of node.arguments) inspectRecipe(argument);
          return;
        }
        node.forEachChild(visit);
      }
      visit(parsed);
      return failures;
    });
  } finally {
    api.close();
  }
}

const EXPORTED_CLASS_NAME = /export\s+(?:const|function|type|class)\s+\w*ClassName\b/;
const EXPORTED_TV_RECIPE = /export\s+const\s+\w+\s*=\s*tv\s*\(/;

describe("docs Tailwind migration contract", () => {
  it("keeps globals.css as the Tailwind entry with the library and demo-stage imports", () => {
    const globals = readFileSync(join(docsRoot, "src/styles/globals.css"), "utf8");
    expect(globals).toContain('@import "tailwindcss";');
    expect(globals).toContain('@import "@elmeragroup/ui/css";');
    expect(globals).toContain('@import "@elmeragroup/ui/themes.css";');
    expect(globals).toContain('@import "@elmeragroup/ui/demo-stage-comfortable.css";');
    expect(globals).toContain('@source "../../../../packages/ui/src";');
    expect(globals).toContain('@source "../../src";');
    expect(globals).not.toContain("@apply");
    expect(globals).not.toMatch(/--control-/);
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
    const sources = srcTsFiles()
      .filter((relative) => relative.startsWith("src/components/"))
      .map((file) => ({ file, source: readFileSync(join(docsRoot, file), "utf8") }));
    expect(recipeSlotFailures(sources)).toEqual([]);
  });
});

describe("recipe interpolation guard", () => {
  it("allows static recipes alongside interpolated labels and unrelated API constants", () => {
    expect(
      recipeSlotFailures([
        {
          file: "valid.tsx",
          source: [
            'const recipe = tv({ slots: { root: "flex", cell: `text-sm` } });',
            "const label = `Page ${name}`;",
            'const apiEndpoint = "/api/themes";',
          ].join("\n"),
        },
      ])
    ).toEqual([]);
  });

  it.each([
    "tv({ slots: { root: `bg-${color}` } })",
    "tv({ slots: { root: `bg-${state.color}` } })",
    "tv({ variants: { active: { true: `text-${getColor()}` } } })",
  ])("rejects interpolated recipe utilities: %s", (source) => {
    expect(recipeSlotFailures([{ file: "invalid.tsx", source }])).toHaveLength(1);
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
