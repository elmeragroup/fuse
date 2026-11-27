import * as Result from "effect/Result";
import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, it } from "vitest";

import { brandTableMarkdown } from "../scripts/lib/page-data-markdown.ts";
import { proseSections } from "../scripts/lib/prose-page.ts";
import type { ProsePageInput } from "../scripts/lib/prose-page.ts";

const PAGE = { href: "/handbook/widgets", label: "Widgets", description: "How widgets work." };

/** A prose page with every construct the reader handles, in the shape the four converted pages use. */
const SOURCE = [
  'import { DocsPage, pageMetadata } from "../../../../components/docs-page";',
  "import {",
  "  WidgetCount,",
  '} from "../../../../components/page-data";',
  "",
  'export const metadata = pageMetadata("/handbook/widgets");',
  "",
  '<DocsPage href="/handbook/widgets">',
  "",
  "Before any heading.",
  "",
  '<h2 id="setup">Set up `widgets`</h2>',
  "",
  "There are <WidgetCount /> widgets.",
  "",
  "{/* prettier-ignore */}",
  "```tsx",
  '<h2 id="not-a-heading">Source</h2>',
  "<Demo>",
  "```",
  "",
  '<h3 id="setup-detail">Detail</h3>',
  "",
  "See [Theming](/handbook/theming#three-axes).",
  "",
  "<Demo",
  '  section="handbook"',
  '  slug="widgets"',
  '  id="widget-demo"',
  '  title="A widget"',
  '  file="widget-demo.tsx">',
  "  <WidgetDemo />",
  "</Demo>",
  "",
  "Under the demo.",
  "",
  '<h2 id="last">Last</h2>',
  "",
  "<WidgetTable />",
  "",
  "</DocsPage>",
  "",
].join("\n");

const input: ProsePageInput = {
  source: SOURCE,
  page: PAGE,
  label: "widgets/page.mdx",
  readDemo: ({ section, slug, file }) =>
    section === "handbook" && slug === "widgets" && file === "widget-demo.tsx"
      ? { sourcePath: "demos/widget-demo.tsx", source: "export const A = 1;" }
      : null,
  dataElements: new Map([
    ["WidgetCount", () => "3"],
    ["WidgetTable", () => "| A |\n| --- |\n| 1 |"],
  ]),
};

describe("prose page sections", () => {
  it("splits at anchored headings and demos, in page order, with the page's own ids", () => {
    // Unit under test: proseSections. Oracle: the hand-written page above, whose anchored
    // headings and demo name these ids, and the markdown each section must print.
    const sections = Result.getOrThrow(proseSections(input));

    expect(sections.map(({ id, depth }) => ({ id, depth }))).toEqual([
      { id: "overview", depth: 2 },
      { id: "setup", depth: 2 },
      { id: "setup-detail", depth: 3 },
      { id: "widget-demo", depth: 2 },
      { id: "last", depth: 2 },
    ]);
    expect(sections.map(({ markdown }) => markdown)).toEqual([
      "# Widgets\n\nHow widgets work.\n\nBefore any heading.",
      [
        "## Set up `widgets`",
        "",
        "There are 3 widgets.",
        "",
        "```tsx",
        '<h2 id="not-a-heading">Source</h2>',
        "<Demo>",
        "```",
      ].join("\n"),
      "### Detail\n\nSee [Theming](/handbook/theming#three-axes).",
      [
        "## A widget",
        "",
        "Source: `demos/widget-demo.tsx`",
        "",
        "```tsx",
        "export const A = 1;",
        "```",
        "",
        "Under the demo.",
      ].join("\n"),
      "## Last\n\n| A |\n| --- |\n| 1 |",
    ]);
  });

  it.each([
    {
      rule: "an element with no markdown",
      body: "<Gadget />",
      problem: "line 2 renders <Gadget />, which has no markdown",
    },
    {
      rule: "an element the reader does not know",
      body: "<Callout>Read this.</Callout>",
      problem: "line 2 holds an element the markdown cannot print: <Callout>",
    },
    {
      rule: "an MDX expression",
      body: "There are {count} widgets.",
      problem: "line 2 holds an expression the markdown cannot print",
    },
    {
      rule: "a markdown heading, whose id the page would slug from its title",
      body: "## Set up",
      problem: 'line 2 is a markdown heading; write it as <h2 id="…"> or <h3 id="…">',
    },
    {
      rule: "a heading title ending in ` #`, which markdown reads as a closing sequence",
      body: '<h2 id="install">Install #</h2>',
      problem:
        'line 2 opens the section "install", whose markdown differs from the page at heading > the 1st node: the page shows text "Install #", the markdown parses to text "Install"',
    },
    {
      rule: "a third-level heading before any second-level one",
      body: '<h3 id="early">Early</h3>',
      problem: "line 2 opens an <h3> before any <h2>",
    },
    {
      rule: "a level-3 demo before any second-level heading, whose <h3> the site renders under the title",
      body: '<Demo section="handbook" slug="widgets" id="d" title="D" level={3} file="widget-demo.tsx" />',
      problem: "line 2 opens an <h3> before any <h2>",
    },
    {
      rule: "a paragraph indented four spaces, which markdown reads as code and MDX as prose",
      body: "    Indented text.",
      problem:
        'line 2 opens the section "overview", whose markdown differs from the page at the 3rd node: the page shows paragraph, the markdown parses to code',
    },
    {
      rule: "a list item's paragraph indented six spaces, which markdown reads as code inside the item",
      body: "- First\n\n      Still the first item.",
      problem:
        'line 2 opens the section "overview", whose markdown differs from the page at list > listItem > the 2nd node: the page shows paragraph, the markdown parses to code',
    },
    {
      rule: 'a <Demo> whose level is the string "3", which the demo frame renders as an h2',
      body: '<Demo section="handbook" slug="widgets" id="d" title="D" level="3" file="widget-demo.tsx" />',
      problem: 'line 2 gives the <Demo> "d" a level other than level={2} or level={3}',
    },
    {
      rule: "a reference-style link, whose definition another section may hold",
      body: "See [Theming][theming].\n\n[theming]: /handbook/theming",
      problem: "line 2 is a reference-style link; write the link inline",
    },
    {
      rule: "a link definition, which a section read alone loses",
      body: "[theming]: /handbook/theming",
      problem: "line 2 is a link definition; write the link inline",
    },
  ])("fails a page with $rule, so the endpoint never drops what the page renders", ({ body, problem }) => {
    const result = proseSections({
      ...input,
      source: `<DocsPage href="/handbook/widgets">\n${body}\n</DocsPage>\n`,
    });

    expect(Result.isFailure(result) ? result.failure.message : "no problem").toContain(
      `widgets/page.mdx: ${problem}`
    );
  });
});

describe("prose page title and lede", () => {
  it.each([
    {
      field: "a title ending in ` #`, which markdown reads as a closing sequence",
      page: { ...PAGE, label: "Widgets #" },
      difference:
        'heading > the 1st node: the page shows text "Widgets #", the markdown parses to text "Widgets"',
    },
    {
      field: "a lede holding `*`, which markdown reads as emphasis",
      page: { ...PAGE, description: "How *widgets* work." },
      difference:
        'paragraph > the 1st node: the page shows text "How *widgets* work.", the markdown parses to text "How "',
    },
  ])("fails a page with $field, because <DocsPage> renders it as plain text", ({ page, difference }) => {
    // Unit under test: proseSections. Oracle: <DocsPage>, which renders the manifest's label and
    // description as literal text, so the lead section must parse to exactly that text.
    const result = proseSections({ ...input, page });

    expect(Result.isFailure(result) ? result.failure.message : "no problem").toContain(
      `widgets/page.mdx: line 10 opens the section "overview", whose markdown differs from the page at ${difference}`
    );
  });
});

describe("prose page MDX reading", () => {
  /** The sections of a page whose `<DocsPage>` holds this body, or the reader's problem. */
  const read = (body: string) =>
    proseSections({ ...input, source: `<DocsPage href="/handbook/widgets">\n\n${body}\n\n</DocsPage>\n` });

  it.each([
    {
      construct: "an element named inside a code span, which MDX renders as literal code",
      body: '<h2 id="count">Count</h2>\n\nWrite `<WidgetCount />` to print the count.',
      markdown: "## Count\n\nWrite `<WidgetCount />` to print the count.",
    },
    {
      construct: "a heading element inside a longer fence, which is code",
      body: [
        '<h2 id="example">Example</h2>',
        "",
        "````mdx",
        "```mdx",
        '<h2 id="inner">Inner</h2>',
        "```",
        "````",
      ].join("\n"),
      markdown: ["## Example", "", "````mdx", "```mdx", '<h2 id="inner">Inner</h2>', "```", "````"].join(
        "\n"
      ),
    },
    {
      construct: "blank lines inside a fence, which the fence keeps",
      body: ['<h2 id="gaps">Gaps</h2>', "", "```ts", "const a = 1;", "", "", "", "const b = 2;", "```"].join(
        "\n"
      ),
      markdown: ["## Gaps", "", "```ts", "const a = 1;", "", "", "", "const b = 2;", "```"].join("\n"),
    },
    {
      construct: "an indented list, whose items stay siblings",
      body: ['<h2 id="steps">Steps</h2>', "", "  - First", "  - Second"].join("\n"),
      markdown: ["## Steps", "", "  - First", "  - Second"].join("\n"),
    },
    {
      construct: "an indented fence, whose code keeps the same indentation as its fence",
      body: ['<h2 id="code">Code</h2>', "", "  ```ts", "  const a = 1;", "  ```"].join("\n"),
      markdown: ["## Code", "", "  ```ts", "  const a = 1;", "  ```"].join("\n"),
    },
  ])("copies $construct unchanged", ({ body, markdown }) => {
    // Unit under test: proseSections. Oracle: CommonMark and MDX, under which this source is
    // plain code, so the section prints it byte for byte.
    expect(Result.getOrThrow(read(body)).at(-1)?.markdown).toBe(markdown);
  });

  it("keeps two lists that an MDX comment separates apart in the markdown", () => {
    // Unit under test: proseSections. Oracle: CommonMark, which reads the section as two lists of
    // one item each only when something other than blank lines stands between them, as the
    // comment does in MDX.
    const markdown = Result.getOrThrow(
      read(['<h2 id="lists">Lists</h2>', "", "- One", "", "{/* split */}", "", "- Two"].join("\n"))
    ).at(-1)?.markdown;
    const lists = fromMarkdown(markdown ?? "").children.filter((node) => node.type === "list");

    expect(lists.map((list) => list.children.length)).toEqual([1, 1]);
  });

  it("fails a heading that holds an expression, which the markdown cannot print", () => {
    const result = read('<h2 id="total">There are {count} widgets</h2>');

    expect(Result.isFailure(result) ? result.failure.message : "no problem").toContain(
      "widgets/page.mdx: line 3 holds an expression the markdown cannot print"
    );
  });
});

describe("library-data tables", () => {
  it("prints the brands table as markdown with the page's columns", () => {
    // Unit under test: brandTableMarkdown. Oracle: these hand-written rows and the table they make,
    // with a pipe in a name escaped so it cannot end the cell.
    expect(
      brandTableMarkdown([
        { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
        { code: "fkse", displayName: "Tele|net", segments: ["private"] },
      ])
    ).toBe(
      [
        "| Code | Display name | Segments |",
        "| --- | --- | --- |",
        "| `fkas` | Fjordkraft | private, company |",
        "| `fkse` | Tele\\|net | private |",
      ].join("\n")
    );
  });
});
