import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { inspectComponentDemos } from "../scripts/lib/docs-inspection.ts";
import { ProblemLog } from "../scripts/lib/errors.ts";
import { renderComponentMarkdown } from "../scripts/lib/markdown.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import { repoRelative } from "../scripts/lib/paths.ts";
import {
  missingNavRoutes,
  missingStudioRoutes,
  staticRouteFile,
  studioRouteFile,
} from "../scripts/lib/routes.ts";
import { readRscStatus } from "../scripts/lib/rsc-status.ts";
import { collectRecipeSources } from "../scripts/lib/sources.ts";
import { extractTokens, readColorTokenMap } from "../scripts/lib/tokens.ts";
import type { DocsComponent } from "../src/lib/docs-model";
import { STATIC_PAGES } from "../src/lib/pages";
import { STUDIO_PAGES } from "../src/studio/registration";

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
    expect(scripts["type-check"]).toBe(
      "next typegen && tsrs --noEmit && tsrs --noEmit -p tsconfig.node.json"
    );
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

  const INTRO = '<ComponentIntro slug="button" />';
  const DEFAULT_DEMO = '<DefaultDemo slug="button" file="button-demo.tsx" />';
  const API_REFERENCE = '<ApiReference slug="button" />';
  const TOKENS = '<ComponentTokens slug="button" />';
  const USAGE = ["## Usage", "", "```tsx", "<A />", "```", ""];

  /** A page with a default stage, so generation holds it to the Usage shape, around `body`. */
  function usagePage(body: readonly string[]): string {
    return page(INTRO, DEFAULT_DEMO, "", ...body, "", API_REFERENCE, TOKENS);
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
      { id: "variants", title: "Variants", file: "button-variant-matrix.tsx", depth: 2 },
      { id: "sizes", title: "Sizes", file: "button-sizes.tsx", depth: 2 },
    ]);
  });

  it("reads the Usage shape: the default stage, the Usage code and the examples, in page order", () => {
    const parsed = parseComponentPage(
      page(
        '<ComponentIntro slug="button" />',
        "",
        '<DefaultDemo slug="button" file="button-demo.tsx">',
        "  <ButtonDemo />",
        "</DefaultDemo>",
        "",
        "## Usage",
        "",
        "```tsx",
        'import { Button } from "@elmeragroup/fuse/button";',
        "",
        "<Button>Button</Button>",
        "```",
        "",
        "## Examples",
        "",
        "<Demo",
        '  slug="button"',
        '  id="outline"',
        '  title="Outline"',
        "  level={3}",
        '  file="button-outline.tsx">',
        "  <ButtonOutline />",
        "</Demo>",
        "",
        '<Demo slug="button" id="ghost" title="Ghost" level={3} file="button-ghost.tsx" />',
        "",
        '<ApiReference slug="button" />',
        "",
        '<ComponentTokens slug="button" />'
      ),
      "button",
      "button/page.mdx"
    );
    expect(parsed.defaultDemo).toBe("button-demo.tsx");
    expect(parsed.usage).toBe(
      'import { Button } from "@elmeragroup/fuse/button";\n\n<Button>Button</Button>'
    );
    expect(parsed.sections).toEqual([
      { kind: "heading", id: "usage", title: "Usage", depth: 2 },
      { kind: "heading", id: "examples", title: "Examples", depth: 2 },
      { kind: "demo", id: "outline", title: "Outline", depth: 3 },
      { kind: "demo", id: "ghost", title: "Ghost", depth: 3 },
    ]);
    // The default stage is untitled, so it is no demo of the outline.
    expect(parsed.demos.map((demo) => demo.file)).toEqual(["button-outline.tsx", "button-ghost.tsx"]);
  });

  it("reads a page without the Usage shape as before: no default stage, no Usage code", () => {
    const parsed = parseComponentPage(
      page('<Demo slug="button" id="a" title="A" file="a.tsx" />', "", "## Limits"),
      "button",
      "button/page.mdx"
    );
    expect(parsed.defaultDemo).toBeNull();
    expect(parsed.usage).toBeNull();
    expect(parsed.sections).toEqual([
      { kind: "demo", id: "a", title: "A", depth: 2 },
      { kind: "heading", id: "limits", title: "Limits", depth: 2 },
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
    [
      "a level-3 <Demo> with no heading before it",
      page('<Demo slug="button" id="a" title="A" level={3} file="a.tsx" />'),
      /needs a "##" heading before it/,
    ],
    [
      "a <Demo> heading level other than 2 or 3",
      page("## Examples", '<Demo slug="button" id="a" title="A" level={4} file="a.tsx" />'),
      /must be 2 or 3, not 4/,
    ],
    [
      "a Usage-shaped page with no code block under Usage",
      usagePage(["## Usage", "", "## Examples"]),
      /"## Usage" holds 0 code blocks, not one/,
    ],
    [
      "a Usage-shaped page with two code blocks under Usage",
      usagePage(["## Usage", "", "```tsx", "<A />", "```", "", "```tsx", "<B />", "```", "", "## Examples"]),
      /"## Usage" holds 2 code blocks, not one/,
    ],
    [
      "a level-3 demo outside Examples on a Usage-shaped page",
      usagePage([
        "## Usage",
        "",
        "```tsx",
        "<A />",
        "```",
        '<Demo slug="button" id="a" title="A" level={3} file="a.tsx" />',
        "",
        "## Examples",
      ]),
      /the demo "a" is not a level=\{3\} demo under "## Examples"/,
    ],
    [
      "a level-2 demo under Examples on a Usage-shaped page",
      usagePage([
        "## Usage",
        "",
        "```tsx",
        "<A />",
        "```",
        "",
        "## Examples",
        '<Demo slug="button" id="a" title="A" file="a.tsx" />',
      ]),
      /the demo "a" is not a level=\{3\} demo under "## Examples"/,
    ],
    [
      "prose on a Usage-shaped page",
      usagePage([
        "<Prose>",
        "A rule.",
        "</Prose>",
        "## Usage",
        "",
        "```tsx",
        "<A />",
        "```",
        "",
        "## Examples",
      ]),
      /it renders <Prose>/,
    ],
    [
      "a self-closing <Prose> on a Usage-shaped page",
      usagePage(['<Prose children="A rule." />', ...USAGE, "## Examples"]),
      /it renders <Prose>/,
    ],
    [
      "a Usage-shaped page with no intro",
      page(DEFAULT_DEMO, ...USAGE, "## Examples", API_REFERENCE, TOKENS),
      /it renders no <ComponentIntro>/,
    ],
    [
      "a Usage-shaped page with its API reference before Usage",
      page(INTRO, DEFAULT_DEMO, API_REFERENCE, ...USAGE, "## Examples", TOKENS),
      /its <ApiReference> comes before "## Examples"/,
    ],
    [
      "a Usage-shaped page with no tokens part",
      page(INTRO, DEFAULT_DEMO, ...USAGE, "## Examples", API_REFERENCE),
      /it renders no <ComponentTokens>/,
    ],
    [
      "another heading on a Usage-shaped page",
      usagePage(["## Usage", "", "```tsx", "<A />", "```", "", "## Examples", "", "## Notes"]),
      /its headings are ## Usage, ## Examples, ## Notes/,
    ],
    [
      "a second <DefaultDemo>",
      page('<DefaultDemo slug="button" file="a.tsx" />', '<DefaultDemo slug="button" file="b.tsx" />'),
      /at most one <DefaultDemo>/,
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
    expect(parsed.sections).toEqual([
      { kind: "heading", id: "composition-limits", title: "Composition limits", depth: 2 },
      { kind: "heading", id: "details", title: "Details", depth: 3 },
    ]);
    expect(parsed.demos).toEqual([]);
  });
});

describe("demo file checks", () => {
  const demosDir = mkdtempSync(join(here, ".demos-"));
  afterAll(() => rmSync(demosDir, { recursive: true, force: true }));
  writeFileSync(join(demosDir, "button-demo.tsx"), '"use client";\n\nexport function ButtonDemo() {}\n');
  writeFileSync(join(demosDir, "button-server.tsx"), "export function ButtonServer() {}\n");

  /** The problems generation reports for a Usage-shaped Button page with this default stage. */
  function problemsFor(defaultDemo: string): readonly string[] {
    const source = [
      "---",
      "lede: A button.",
      "---",
      '<ComponentIntro slug="button" />',
      `<DefaultDemo slug="button" file="${defaultDemo}" />`,
      "## Usage",
      "```tsx",
      "<Button />",
      "```",
      "## Examples",
      '<ApiReference slug="button" />',
      '<ComponentTokens slug="button" />',
    ].join("\n");
    const problems = new ProblemLog();
    inspectComponentDemos(
      {
        slug: "button",
        page: parseComponentPage(source, "button", "button/page.mdx"),
        paths: { ...resolveComponentPaths("button"), demosDir },
      },
      problems
    );
    return problems.problems;
  }

  it("holds the default stage to the checks every demo gets, without listing it as a demo", () => {
    const relative = (file: string): string => repoRelative(join(demosDir, file));
    // A client default stage passes; the server file beside it is only never rendered.
    expect(problemsFor("button-demo.tsx")).toEqual([
      "button: demo file button-server.tsx is never rendered by the page",
    ]);
    expect(problemsFor("button-server.tsx")).toContain(
      `${relative("button-server.tsx")}: a demo must start with a "use client" directive`
    );
    expect(problemsFor("button-missing.tsx")).toContain(
      `${relative("button-missing.tsx")}: the page renders this demo, but the file does not exist`
    );
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

  it("names a studio page whose route is gone, under the studio route group", () => {
    expect(studioRouteFile("/studio").endsWith(join("src", "app", "(studio)", "studio", "page.tsx"))).toBe(
      true
    );
    expect(missingStudioRoutes(STUDIO_PAGES, () => false)).toEqual(STUDIO_PAGES.map((page) => page.href));
    expect(missingStudioRoutes()).toEqual([]);
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

  it("reads the variable of a shorthand with a fallback", () => {
    const tokens = extractTokens({
      sources: ['const a = "text-sm leading-(--paragraph-leading-sm,1.421875rem)";'],
      stylesheets: [],
      colors,
    });
    expect(tokens).toEqual([{ name: "--paragraph-leading-sm", isColor: false }]);
  });

  it("reads a theme colour named in an arbitrary value as its role", () => {
    const tokens = extractTokens({
      sources: [
        'const a = "bg-[repeating-linear-gradient(45deg,transparent,--theme(--color-selection-disabled-hatch)_8px)]";',
      ],
      stylesheets: [],
      colors,
    });
    expect(tokens).toEqual([{ name: "--selection-disabled-hatch", isColor: true }]);
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
    // The smaller set: exactly these three, nothing more. Extraction reads whole files, so
    // `--error` arrives with the focused invalid ring that shares `styles/utils.ts` with the
    // focus ring ScrollArea's viewport takes.
    ["ScrollArea", "scroll-area", ["--border", "--error", "--ring"]],
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
    intro: "",
    apis: [{ slug: "widget", entry: "@elmeragroup/fuse/widget" }],
    sourcePath: "packages/fuse/src/components/widget/widget.tsx",
    sourceUrl: "https://example.invalid/widget.tsx",
    markdownUrl: "/components/widget.md",
    rsc: "client",
    sections: [{ kind: "demo", id: "basic", title: "Basic", depth: 2 }],
    usage: null,
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

  it("mirrors a Usage-shaped page: H1, lede, Usage code, the examples with their source, API, tokens", () => {
    const usage = 'import { Widget } from "@elmeragroup/fuse/widget";\n\n<Widget />';
    const markdown = renderComponentMarkdown({
      ...component,
      usage,
      sections: [
        { kind: "heading", id: "usage", title: "Usage", depth: 2 },
        { kind: "heading", id: "examples", title: "Examples", depth: 2 },
        { kind: "demo", id: "basic", title: "Basic", depth: 3 },
      ],
    });
    const headings = markdown.split("\n").filter((line) => /^#{1,3} /u.test(line));
    expect(headings).toEqual([
      "# Widget",
      "## Usage",
      "## Examples",
      "### Basic",
      "## API reference",
      "### Widget · RSC: client",
      "## Tokens consumed",
    ]);
    expect(markdown).toContain(`## Usage\n\n\`\`\`tsx\n${usage}\n\`\`\``);
    expect(markdown).toContain(
      "### Basic\n\nSource: `apps/docs/src/app/(docs)/components/widget/demos/widget-basic.tsx`"
    );
    expect(markdown).toContain("export function WidgetBasic() {}");
    // The page itself shows no import list or RSC line, so its mirror leaves them out too.
    expect(markdown).not.toContain("- Import:");
    expect(markdown).not.toContain("- RSC:");
  });

  it("prints each heading once: the intro's under the lede, none for a prose heading over its demo", () => {
    const page = parseComponentPage(
      [
        "---",
        "lede: A widget.",
        "---",
        "<Prose>",
        "",
        "## Composition limits",
        "",
        "One bar per root.",
        "",
        "### Two axes",
        "",
        "Mount two bars.",
        "",
        "</Prose>",
        "",
        '<Demo slug="widget" id="basic" title="Basic" file="widget-basic.tsx" />',
        "",
        "<Prose>",
        "",
        "## Thumbnails",
        "",
        "Map your own indicators.",
        "",
        "</Prose>",
        "",
        '<Demo slug="widget" id="thumbnails" title="Thumbnails" file="widget-thumbnails.tsx" />',
      ].join("\n"),
      "widget",
      "widget/page.mdx"
    );
    const thumbnails = {
      id: "thumbnails",
      title: "Thumbnails",
      sourcePath: "apps/docs/src/app/(docs)/components/widget/demos/widget-thumbnails.tsx",
      source: "export function WidgetThumbnails() {}",
    };
    const markdown = renderComponentMarkdown({
      ...component,
      intro: page.intro,
      sections: page.sections,
      demos: [...component.demos, thumbnails],
    });
    const headings = markdown.split("\n").filter((line) => /^#{1,3} /u.test(line));
    expect(headings).toEqual([
      "# Widget",
      "## Composition limits",
      "### Two axes",
      "## Basic",
      "## Thumbnails",
      "## API reference",
      "### Widget · RSC: client",
      "## Tokens consumed",
    ]);
    expect(markdown).toContain(
      "# Widget\n\nA widget.\n\n## Composition limits\n\nOne bar per root.\n\n### Two axes\n\nMount two bars.\n"
    );
    expect(markdown).toContain(
      "## Thumbnails\n\nSource: `apps/docs/src/app/(docs)/components/widget/demos/widget-thumbnails.tsx`"
    );
    // Both prose headings stay in the outline.
    expect(page.sections.map((section) => section.id)).toEqual([
      "composition-limits",
      "two-axes",
      "basic",
      "thumbnails",
      "thumbnails",
    ]);
  });
});

describe("Collapsible settle override (collapsible/page.mdx)", () => {
  // The page hands readers the exact utilities that settle `Collapsible.Content`. That sentence
  // is only true while each one cancels what the library actually applies, and the library side
  // is spread over two files — `panelHeightTransition` and the height variable `Content`
  // appends. So read all three strings from source rather than restating any of them here: a
  // change to either library file fails this test instead of quietly rotting the prose.
  const readOne = (file: string, pattern: RegExp): string => {
    // oxlint-disable-next-line fuse/no-source-reading-tests -- docs drift contract: the page's settle utilities must cancel what the library applies, read from the two library files that apply it
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
