import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { readRscStatus } from "../scripts/lib/api.ts";
import { parseShellFrontmatter, splitFrontmatter } from "../scripts/lib/frontmatter.ts";
import { renderComponentMarkdown } from "../scripts/lib/markdown.ts";
import { readContentHeadings, stampHeadingAnchors } from "../scripts/lib/mdx.ts";
import { collectRecipeSources } from "../scripts/lib/sources.ts";
import { extractTokens, readColorTokenMap } from "../scripts/lib/tokens.ts";
import type { DocsComponent } from "../src/lib/docs-model";
import { slugifyHeading } from "../src/lib/slug";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const uiCss = readFileSync(join(repoRoot, "packages/ui/src/styles/ui.css"), "utf8");
const colors = readColorTokenMap(uiCss);

describe("frontmatter", () => {
  const source = [
    "---",
    "title: Button",
    "lede: >",
    "  First line",
    "  second line",
    "demos:",
    "  - id: variants",
    "    title: Variants",
    "    file: button-variant-matrix.tsx",
    "---",
    "",
    "## Prose heading",
    "",
    "Body.",
  ].join("\n");

  it("splits the block and keeps the body's line numbers", () => {
    const split = splitFrontmatter(source);
    expect(split.frontmatter).toContain("title: Button");
    expect(split.body.split("\n").length).toBe(source.split("\n").length);
    expect(split.body.trim()).toBe("## Prose heading\n\nBody.");
  });

  it("folds a `>` scalar and reads the demo list in order", () => {
    const { frontmatter } = splitFrontmatter(source);
    const parsed = parseShellFrontmatter(frontmatter, "button.mdx");
    expect(parsed.title).toBe("Button");
    expect(parsed.lede).toBe("First line second line");
    expect(parsed.demos).toEqual([{ id: "variants", title: "Variants", file: "button-variant-matrix.tsx" }]);
  });

  it("rejects an unknown key rather than ignoring it", () => {
    expect(() => parseShellFrontmatter("title: X\nlede: Y\nnope: 1", "x.mdx")).toThrow(
      /unknown frontmatter key/
    );
  });

  it("requires a title and a lede", () => {
    expect(() => parseShellFrontmatter("title: X", "x.mdx")).toThrow(/"lede" is required/);
  });
});

describe("MDX body headings", () => {
  it("collects ATX headings and skips fenced code", () => {
    const body = ["## Composition", "", "```tsx", "## not a heading", "```", "", "### Details"].join("\n");
    expect(readContentHeadings(body)).toEqual([
      { id: "composition", title: "Composition", depth: 2 },
      { id: "details", title: "Details", depth: 3 },
    ]);
  });

  it("stamps the same anchors it reports to the TOC", () => {
    const body = ["## Composition limits", "", "text", "", "```tsx", "## fenced", "```"].join("\n");
    const stamped = stampHeadingAnchors(body);
    expect(stamped).toContain('<h2 id="composition-limits">Composition limits</h2>');
    expect(stamped).toContain("## fenced");
    expect(readContentHeadings(body)[0]?.id).toBe(slugifyHeading("Composition limits"));
  });
});

describe("RSC classification", () => {
  it("reads a leading directive, not a later string expression", () => {
    expect(readRscStatus('"use client";\n\nexport const a = 1;\n')).toBe("client");
    expect(readRscStatus("// comment\n'use client';\nexport const a = 1;\n")).toBe("client");
    expect(readRscStatus('export const a = 1;\n"use client";\n')).toBe("server");
    expect(readRscStatus("export const a = 1;\n")).toBe("server");
  });

  it("matches the library sources it classifies", () => {
    expect(
      readRscStatus(readFileSync(join(repoRoot, "packages/ui/src/components/button/button.tsx"), "utf8"))
    ).toBe("client");
    expect(
      readRscStatus(readFileSync(join(repoRoot, "packages/ui/src/components/badge/badge.tsx"), "utf8"))
    ).toBe("server");
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

  it("reproduces the tokens button.md §5 lists", () => {
    const recipe = collectRecipeSources(join(repoRoot, "packages/ui/src/components/button"));
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

  it("reproduces the much smaller set scroll-area.md §5 lists", () => {
    const recipe = collectRecipeSources(join(repoRoot, "packages/ui/src/components/scroll-area"));
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
    entry: "@elmeragroup/ui/widget",
    exportName: "Widget",
    sourcePath: "packages/ui/src/components/widget/widget.tsx",
    sourceUrl: "https://example.invalid/widget.tsx",
    markdownUrl: "/components/widget.md",
    rsc: "client",
    headings: [],
    hasContent: false,
    demos: [
      {
        id: "basic",
        title: "Basic",
        exportName: "WidgetBasic",
        sourcePath: "apps/docs/src/app/(docs)/components/widget/demos/widget-basic.tsx",
        source: "export function WidgetBasic() {}",
        highlighted: "<span></span>",
        modulePath: "./demos/widget/widget-basic",
      },
    ],
    parts: [
      {
        name: "Widget",
        rsc: "client",
        sourcePath: "packages/ui/src/components/widget/widget.tsx",
        forwardedFrom: ["@types/react"],
        forwardedCount: 3,
        props: [
          {
            name: "tone",
            origin: "recipe-axis",
            type: '"a" | "b"',
            defaultValue: '"a"',
            description: "",
            required: false,
          },
          {
            name: "label",
            origin: "declared",
            type: "string",
            defaultValue: null,
            description: "Visible text.",
            required: true,
          },
        ],
      },
    ],
    tokens: [{ name: "--primary", isColor: true }],
  };

  it("carries the demo source, the RSC column and the tokens list", () => {
    const markdown = renderComponentMarkdown(component);
    expect(markdown).toContain("export function WidgetBasic() {}");
    expect(markdown).toContain("| Prop | Type | Default | Required | RSC | Description |");
    expect(markdown).toContain("| `label` | `string` | — | yes | client | Visible text. |");
    expect(markdown).toContain("Plus 3 forwarded props from `@types/react`.");
    expect(markdown).toContain("- `--primary` (colour)");
  });

  it("labels a recipe axis instead of leaving an empty description cell", () => {
    expect(renderComponentMarkdown(component)).toContain("| `tone` |");
    expect(renderComponentMarkdown(component)).toContain("Recipe axis.");
  });
});
