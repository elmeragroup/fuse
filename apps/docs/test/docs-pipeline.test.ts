import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { readRscStatus } from "../scripts/lib/docs-inspection.ts";
import { renderComponentMarkdown } from "../scripts/lib/markdown.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import { missingNavRoutes, staticRouteFile } from "../scripts/lib/routes.ts";
import { collectRecipeSources } from "../scripts/lib/sources.ts";
import { extractTokens, readColorTokenMap } from "../scripts/lib/tokens.ts";
import type { DocsComponent } from "../src/lib/docs-model";
import { STATIC_PAGES } from "../src/lib/pages";
import { slugifyHeading } from "../src/lib/slug";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const repoRoot = join(here, "../../..");
const fuseCss = readFileSync(join(repoRoot, "packages/fuse/src/styles/fuse.css"), "utf8");
const colors = readColorTokenMap(fuseCss);

describe("docs generation ownership", () => {
  const parsed: unknown = JSON.parse(readFileSync(join(docsRoot, "package.json"), "utf8"));
  if (parsed === null || Array.isArray(parsed)) {
    throw new Error("apps/docs/package.json is not an object");
  }
  // SAFETY: this test only reads the three script strings that define generate ownership.
  const scripts = (parsed as { scripts: { build: string; "type-check": string; dev: string } }).scripts;
  const turbo = readFileSync(join(docsRoot, "turbo.json"), "utf8");

  it("does not nest generate inside package build or type-check", () => {
    expect(scripts.build).toBe("next build");
    expect(scripts["type-check"]).toBe("next typegen && tsc --noEmit");
    expect(scripts.build).not.toContain("pnpm run generate");
    expect(scripts["type-check"]).not.toContain("pnpm run generate");
    expect(scripts.dev).toContain("pnpm run generate");
  });

  it("lets Turbo own generate before build and type-check", () => {
    const build = /"build":\s*\{([^{}]*)\}/s.exec(turbo)?.[1];
    const typeCheck = /"type-check":\s*\{([^{}]*)\}/s.exec(turbo)?.[1];
    expect(build, "turbo.json is missing a build task block").toBeDefined();
    expect(typeCheck, "turbo.json is missing a type-check task block").toBeDefined();
    expect(build).toMatch(/"dependsOn"\s*:\s*\[[^\]]*"generate"/);
    expect(typeCheck).toMatch(/"dependsOn"\s*:\s*\[[^\]]*"generate"/);
  });
});

describe("authored page.mdx as generation input", () => {
  function page(...body: readonly string[]): string {
    return ["---", "title: Button", "lede: >", "  First line", "  second line", "---", "", ...body].join(
      "\n"
    );
  }

  it("folds a `>` lede and reads the demos the page renders, in order", () => {
    const parsed = parseComponentPage(
      page(
        '<Demo slug="button" id="variants" title="Variants" file="button-variant-matrix.tsx">',
        "  <ButtonVariantMatrix />",
        "</Demo>",
        "",
        '<Demo slug="button" id="sizes" title="Sizes" file="button-sizes.tsx">',
        "  <ButtonSizes />",
        "</Demo>"
      ),
      "button",
      "button/page.mdx"
    );
    expect(parsed.title).toBe("Button");
    expect(parsed.lede).toBe("First line second line");
    expect(parsed.demos).toEqual([
      { id: "variants", title: "Variants", file: "button-variant-matrix.tsx" },
      { id: "sizes", title: "Sizes", file: "button-sizes.tsx" },
    ]);
  });

  it("rejects an unknown frontmatter key rather than ignoring it", () => {
    expect(() => parseComponentPage("---\ntitle: X\nlede: Y\nnope: 1\n---\n", "x", "x.mdx")).toThrow(
      /unknown frontmatter key/
    );
  });

  it("requires a title and a lede", () => {
    expect(() => parseComponentPage("---\ntitle: X\n---\n", "x", "x.mdx")).toThrow(/"lede" is required/);
  });

  it("refuses a <Demo> that is missing an attribute, or names another page's slug", () => {
    expect(() =>
      parseComponentPage(page('<Demo slug="button" id="a" title="A" />'), "button", "x.mdx")
    ).toThrow(/missing its "file" attribute/);
    expect(() =>
      parseComponentPage(page('<Demo slug="card" id="a" title="A" file="a.tsx" />'), "button", "x.mdx")
    ).toThrow(/names slug "card" on the "button" page/);
  });

  it("collects ATX headings for the TOC and reads fenced code as source, not structure", () => {
    const parsed = parseComponentPage(
      page(
        "## Composition limits",
        "",
        "```tsx",
        "## not a heading",
        '<Demo slug="button" id="fenced" title="Fenced" file="fenced.tsx" />',
        "```",
        "",
        "### Details"
      ),
      "button",
      "button/page.mdx"
    );
    expect(parsed.headings).toEqual([
      { id: slugifyHeading("Composition limits"), title: "Composition limits", depth: 2 },
      { id: "details", title: "Details", depth: 3 },
    ]);
    expect(parsed.demos).toEqual([]);
  });
});

describe("nav destination verification (docs-site.md §3.3)", () => {
  it("passes for the authored nav as it stands: every entry has a route module", () => {
    expect(missingNavRoutes()).toEqual([]);
  });

  it("names the entry that would ship a 404, so generation fails instead of the SideNav", () => {
    // The probe stands in for a deleted or renamed route file. The generation pass turns
    // exactly this list into problems, and a non-empty problem log fails the docs build.
    const gone = staticRouteFile("/handbook/tokens");
    expect(missingNavRoutes(STATIC_PAGES, (file) => file !== gone)).toEqual(["/handbook/tokens"]);
    expect(missingNavRoutes(STATIC_PAGES, () => false)).toEqual(STATIC_PAGES.map((page) => page.href));
  });
});

describe("RSC classification", () => {
  it("reads a leading directive, not a later string expression", () => {
    expect(readRscStatus('"use client";\n\nexport const a = 1;\n')).toBe("client");
    expect(readRscStatus("// comment\n'use client';\nexport const a = 1;\n")).toBe("client");
    expect(readRscStatus('/** doc */\n"use strict";\n"use client";\n')).toBe("client");
    expect(readRscStatus('export const a = 1;\n"use client";\n')).toBe("server");
    expect(readRscStatus("export const a = 1;\n")).toBe("server");
  });

  it("matches the library sources it classifies", () => {
    expect(
      readRscStatus(readFileSync(join(repoRoot, "packages/fuse/src/components/button/button.tsx"), "utf8"))
    ).toBe("client");
    expect(
      readRscStatus(readFileSync(join(repoRoot, "packages/fuse/src/components/badge/badge.tsx"), "utf8"))
    ).toBe("server");
    expect(
      readRscStatus(
        readFileSync(join(repoRoot, "packages/fuse/src/react-aria/focusable/focusable.tsx"), "utf8")
      )
    ).toBe("client");
  });
});

describe("token extraction", () => {
  it("derives the utility → token map from the library's own @theme block", () => {
    expect(colors.get("primary")).toBe("--primary");
    expect(colors.get("error")).toBe("--error");
    expect(colors.get("sm")).toBeUndefined();
  });

  it("resolves colour utilities, var() and the Tailwind variable shorthand", () => {
    const tokens = extractTokens({
      sources: ['const a = "bg-primary hover:text-error/20 h-(--control-h-md) text-sm";'],
      stylesheets: [".x { color: var(--foreground); }"],
      colors,
    });
    expect(tokens.map((token) => token.name)).toEqual([
      "--control-h-md",
      "--error",
      "--foreground",
      "--primary",
    ]);
    expect(tokens.find((token) => token.name === "--primary")?.isColor).toBe(true);
    expect(tokens.find((token) => token.name === "--control-h-md")?.isColor).toBe(false);
  });

  it("extracts the tokens consumed by Button", () => {
    const recipe = collectRecipeSources(join(repoRoot, "packages/fuse/src/components/button"));
    const names = extractTokens({
      sources: recipe.sources,
      stylesheets: recipe.stylesheets,
      colors,
    }).map((token) => token.name);
    for (const expected of [
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--background",
      "--foreground",
      "--border",
      "--ring",
      "--error",
      "--success",
      "--radius-md",
      "--control-h-md",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("extracts the smaller token set consumed by ScrollArea", () => {
    const recipe = collectRecipeSources(join(repoRoot, "packages/fuse/src/components/scroll-area"));
    const names = extractTokens({
      sources: recipe.sources,
      stylesheets: recipe.stylesheets,
      colors,
    }).map((token) => token.name);
    expect(names).toEqual(["--background", "--border", "--ring"]);
  });
});

describe("markdown endpoint rendering", () => {
  const component: DocsComponent = {
    slug: "widget",
    title: "Widget",
    lede: "A widget.",
    entry: "@elmeragroup/fuse/widget",
    exportName: "Widget",
    sourcePath: "packages/fuse/src/components/widget/widget.tsx",
    sourceUrl: "https://example.invalid/widget.tsx",
    markdownUrl: "/components/widget.md",
    rsc: "client",
    headings: [],
    demos: [
      {
        id: "basic",
        title: "Basic",
        sourcePath: "apps/docs/src/app/(docs)/components/widget/demos/widget-basic.tsx",
        source: "export function WidgetBasic() {}",
      },
    ],
    parts: [
      {
        name: "Widget",
        rsc: "client",
        sourcePath: "packages/fuse/src/components/widget/widget.tsx",
        forwardedFrom: ["@types/react"],
        forwardedCount: 3,
        props: [
          {
            name: "tone",
            origin: "recipe-axis",
            type: '"a" | "b"',
            shortType: null,
            defaultValue: '"a"',
            description: "",
            required: false,
          },
          {
            name: "label",
            origin: "declared",
            type: "string",
            shortType: null,
            defaultValue: null,
            description: "Visible text.",
            required: true,
          },
        ],
      },
    ],
    tokens: [{ name: "--primary", isColor: true }],
  };

  it("carries the demo source, RSC per part on the heading, and the tokens list", () => {
    const markdown = renderComponentMarkdown(component);
    expect(markdown).toContain("export function WidgetBasic() {}");
    // RSC is a per-part fact (docs-site.md §8): a badge on the part heading, not a column.
    expect(markdown).toContain("### Widget · RSC: client");
    expect(markdown).toContain("| Prop | Type | Default | Required | Description |");
    expect(markdown).not.toContain("| RSC |");
    expect(markdown).toContain("| `label` | `string` | — | yes | Visible text. |");
    expect(markdown).toContain("Plus 3 forwarded props from `@types/react`.");
    expect(markdown).toContain("- `--primary` (colour)");
  });

  it("labels a recipe axis instead of leaving an empty description cell", () => {
    expect(renderComponentMarkdown(component)).toContain("| `tone` |");
    expect(renderComponentMarkdown(component)).toContain("Recipe axis.");
  });
});

describe("Collapsible settle override (collapsible/page.mdx)", () => {
  // The page hands readers the exact utilities that settle `Collapsible.Content`. That sentence
  // is only true while each one cancels what the library actually applies, and the library side
  // is spread over two files — `panelHeightTransition` and the height variable `Content`
  // appends. So read all three strings from source rather than restating any of them here: a
  // change to either library file fails this test instead of quietly rotting the prose.
  const readOne = (file: string, pattern: RegExp): string => {
    const match = pattern.exec(readFileSync(join(repoRoot, file), "utf8"));
    if (match?.[1] === undefined) {
      throw new Error(`No match for ${String(pattern)} in ${file}`);
    }
    return match[1];
  };

  const applied = [
    readOne(
      "packages/fuse/src/styles/panel-height.ts",
      /export const panelHeightTransition = cn\(\s*"([^"]+)"/
    ),
    readOne(
      "packages/fuse/src/components/collapsible/collapsible.tsx",
      /mergeClassName\(className, panelHeightTransition, "([^"]+)"\)/
    ),
  ].join(" ");

  const documented = readOne(
    "apps/docs/src/app/(docs)/components/collapsible/page.mdx",
    /set its `className` to\s+`([^`]+)`/
  );

  // Clipping and the height animation are the two things the page promises to switch off;
  // `ease-out` and `duration-150` need no counterpart once `transition` is cancelled.
  const SETTLED = new Set(["overflow", "transition", "h"]);

  /** Index utilities by the variant and property each one sets, keeping only the settled ones. */
  const byTarget = (classes: string): Map<string, string> => {
    const targets = new Map<string, string>();
    for (const utility of classes.split(/\s+/).filter(Boolean)) {
      const colon = utility.lastIndexOf(":");
      const variant = colon === -1 ? "" : utility.slice(0, colon);
      const base = utility.slice(colon + 1);
      const property = base.slice(0, base.indexOf("-"));
      if (SETTLED.has(property)) {
        targets.set(`${variant}|${property}`, base);
      }
    }
    return targets;
  };

  it("cancels every clipping and height utility Collapsible.Content applies", () => {
    const overrides = byTarget(documented);
    for (const [target, base] of byTarget(applied)) {
      expect(overrides.get(target), `documented override is missing ${target}`).toBeDefined();
      expect(overrides.get(target)).not.toBe(base);
    }
  });
});
