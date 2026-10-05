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

  it("lets Turbo own generate before build and type-check, never nesting it in the package scripts", () => {
    expect(scripts.build).toBe("next build");
    expect(scripts["type-check"]).toBe("next typegen && tsc --noEmit");
    expect(scripts.build).not.toContain("pnpm run generate");
    expect(scripts["type-check"]).not.toContain("pnpm run generate");
    expect(scripts.dev).toContain("pnpm run generate");

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
    return ["---", "lede: >", "  First line", "  second line", "---", "", ...body].join("\n");
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
    expect(parsed.lede).toBe("First line second line");
    expect(parsed.demos).toEqual([
      { id: "variants", title: "Variants", file: "button-variant-matrix.tsx" },
      { id: "sizes", title: "Sizes", file: "button-sizes.tsx" },
    ]);
  });

  // `title` is the one frontmatter key that used to be legal: the page title is derived
  // from the slug, so a page that still declares one fails instead of carrying a second
  // name. An arbitrary key is rejected by the same branch, named in the message.
  it.each([
    ["an unknown frontmatter key", "---\ntitle: Button\nlede: Y\n---\n", /unknown frontmatter key/],
    ["an unknown frontmatter key, named", "---\nlede: Y\nnope: 1\n---\n", /unknown frontmatter key "nope"/],
    ["a missing lede", "---\nlede:\n---\n", /"lede" is required/],
    [
      "a <Demo> missing its file attribute",
      page('<Demo slug="button" id="a" title="A" />'),
      /missing its "file" attribute/,
    ],
    [
      "a <Demo> naming another page's slug",
      page('<Demo slug="card" id="a" title="A" file="a.tsx" />'),
      /names slug "card" on the "button" page/,
    ],
  ] as const)("rejects %s rather than ignoring it", (_case, source, message) => {
    expect(() => parseComponentPage(source, "button", "x.mdx")).toThrow(message);
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
      { id: "composition-limits", title: "Composition limits", depth: 2 },
      { id: "details", title: "Details", depth: 3 },
    ]);
    expect(parsed.demos).toEqual([]);
  });
});

describe("nav destination verification", () => {
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
});

describe("token extraction", () => {
  it("resolves colour utilities, var() and the Tailwind variable shorthand", () => {
    const tokens = extractTokens({
      sources: [
        'const a = "bg-primary hover:text-error/20 h-(--control-h-md) text-sm";',
        'const b = "text-(length:--control-text) leading-(--control-leading)";',
      ],
      stylesheets: [".x { color: var(--foreground); }"],
      colors,
    });
    expect(tokens.map((token) => token.name)).toEqual([
      "--control-h-md",
      "--control-leading",
      "--control-text",
      "--error",
      "--foreground",
      "--primary",
    ]);
    expect(tokens.find((token) => token.name === "--primary")?.isColor).toBe(true);
    expect(tokens.find((token) => token.name === "--control-h-md")?.isColor).toBe(false);
  });

  it("maps a colour utility with a fallback to its first token", () => {
    const map = readColorTokenMap(
      "@theme inline {\n  --color-ring: var(--ring);\n  --color-edge: var(--edge, var(--border));\n}\n"
    );
    expect([...map]).toEqual([
      ["ring", "--ring"],
      ["edge", "--edge"],
    ]);
  });

  it.each([
    [
      "Button",
      "button",
      expect.arrayContaining([
        "--primary",
        "--primary-foreground",
        "--secondary",
        "--secondary-foreground",
        "--muted",
        "--background",
        "--foreground",
        "--button-outline",
        "--button-outline-width",
        "--ring",
        "--error",
        "--success",
        "--secondary-hover",
        "--radius-button",
        "--control-h-md",
        "--control-px-button-md",
      ]),
    ],
    // The smaller set: exactly these three, nothing more.
    ["ScrollArea", "scroll-area", ["--background", "--border", "--ring"]],
  ] as const)("extracts the tokens consumed by %s", (_name, directory, expected) => {
    const recipe = collectRecipeSources(join(repoRoot, "packages/fuse/src/components", directory));
    const names = extractTokens({
      sources: recipe.sources,
      stylesheets: recipe.stylesheets,
      colors,
    }).map((token) => token.name);
    expect(names).toEqual(expected);
  });
});

describe("markdown endpoint rendering", () => {
  const component: DocsComponent = {
    slug: "widget",
    title: "Widget",
    lede: "A widget.",
    entry: "@elmeragroup/fuse/widget",
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

  it("carries the demo source, RSC per part on the heading, the tokens list, and a recipe-axis label", () => {
    const markdown = renderComponentMarkdown(component);
    expect(markdown).toContain("export function WidgetBasic() {}");
    // RSC is a per-part fact: a badge on the part heading, not a column.
    expect(markdown).toContain("### Widget · RSC: client");
    expect(markdown).toContain("| Prop | Type | Default | Required | Description |");
    expect(markdown).not.toContain("| RSC |");
    expect(markdown).toContain("| `label` | `string` | — | yes | Visible text. |");
    expect(markdown).toContain("Plus 3 forwarded props from `@types/react`.");
    expect(markdown).toContain("- `--primary` (colour)");
    // A recipe axis is labelled instead of leaving an empty description cell.
    expect(markdown).toContain("| `tone` |");
    expect(markdown).toContain("Recipe axis.");
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
