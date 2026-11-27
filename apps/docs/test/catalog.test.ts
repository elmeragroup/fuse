import { describe, expect, it } from "vitest";

import type { Catalog, CatalogDocument, CatalogSection } from "@elmeragroup/docs-catalog";

import { catalogProblems } from "../scripts/lib/catalog.ts";

const usage: CatalogSection = {
  id: "usage",
  depth: 2,
  markdown: [
    "## Usage",
    "",
    "Theme it as [Theming](/handbook/theming) says, and read [the part](/components/widget.md#api-widget).",
    "",
    "```tsx",
    "// A link in a code block is source, not a link: [x](/components/missing)",
    "```",
  ].join("\n"),
};

const widget: CatalogDocument = {
  href: "/components/widget",
  title: "Widget",
  group: "Components",
  description: "A widget.",
  keywords: ["widget"],
  sections: [
    { id: "overview", depth: 2, markdown: "# Widget\n\nA widget." },
    usage,
    { id: "api-reference", depth: 2, markdown: "## API reference" },
    { id: "api-widget", depth: 3, markdown: "### Widget" },
  ],
};

const theming: CatalogDocument = {
  href: "/handbook/theming",
  title: "Theming",
  group: "Handbook",
  description: "Themes.",
  keywords: ["/handbook/theming"],
  sections: [],
};

const valid: Catalog = { documents: [widget, theming], index: "# Fuse\n" };
const COMPONENTS = ["/components/widget"];

/** The valid catalog with the widget's sections replaced. */
function withWidgetSections(sections: readonly CatalogSection[]): Catalog {
  return { ...valid, documents: [{ ...widget, sections }, theming] };
}

/** The valid catalog with one more widget section holding `markdown`. */
function withWidgetSection(markdown: string): Catalog {
  return withWidgetSections([...widget.sections, { id: "extra", depth: 3, markdown }]);
}

describe("docs catalog checks", () => {
  it("accepts a catalog whose links resolve to a page, its `.md` endpoint or a section", () => {
    expect(catalogProblems(valid, COMPONENTS)).toEqual([]);
  });

  it.each([
    {
      rule: "a component route with no sections",
      catalog: {
        ...valid,
        documents: [...valid.documents, { ...widget, href: "/components/gadget", sections: [] }],
      },
      components: [...COMPONENTS, "/components/gadget"],
      problems: ["the component route /components/gadget has no sections"],
    },
    {
      rule: "a component route with no document",
      catalog: valid,
      components: [...COMPONENTS, "/components/gadget"],
      problems: ["the component route /components/gadget has no sections"],
    },
    {
      rule: "two documents with one href",
      catalog: { ...valid, documents: [...valid.documents, theming] },
      components: COMPONENTS,
      problems: ["two documents share the href /handbook/theming"],
    },
    {
      rule: "a repeated section id",
      catalog: withWidgetSections([...widget.sections, { ...usage, depth: 3 }]),
      components: COMPONENTS,
      problems: ['/components/widget repeats the section id "usage"'],
    },
    {
      rule: "a section over 50,000 characters",
      catalog: withWidgetSection("x".repeat(50_001)),
      components: COMPONENTS,
      problems: ["/components/widget#extra holds 50001 characters, over the 50000 a section may hold"],
    },
    {
      rule: "a link to no document",
      catalog: withWidgetSection("See [Gizmo](/components/gizmo.md)."),
      components: COMPONENTS,
      problems: ["/components/widget#extra links to /components/gizmo.md, which is no document"],
    },
    {
      rule: "a relative link to no document",
      catalog: withWidgetSection("See [Gizmo](./gizmo)."),
      components: COMPONENTS,
      problems: ["/components/widget#extra links to ./gizmo, which is no document"],
    },
    {
      rule: "a reference-style link to no document",
      catalog: withWidgetSection("See [Gizmo][gizmo].\n\n[gizmo]: /components/gizmo"),
      components: COMPONENTS,
      problems: ["/components/widget#extra links to /components/gizmo, which is no document"],
    },
    {
      rule: "a `.md` link to a document without sections",
      catalog: withWidgetSection("See [Theming](/handbook/theming.md)."),
      components: COMPONENTS,
      problems: [
        "/components/widget#extra links to /handbook/theming.md, which is no markdown endpoint: /handbook/theming has no sections",
      ],
    },
    {
      rule: "a link to no section of a document",
      catalog: withWidgetSection("See [the props](/components/widget#api-gizmo)."),
      components: COMPONENTS,
      problems: [
        "/components/widget#extra links to /components/widget#api-gizmo, which names no section of /components/widget",
      ],
    },
  ])("rejects $rule", ({ catalog, components, problems }) => {
    expect(catalogProblems(catalog, components)).toEqual(problems);
  });

  it.each([
    { link: "a link inside inline code", markdown: "Write `[Gizmo](/components/gizmo)` as text." },
    {
      link: "a link inside a fenced block",
      markdown: "```md\n[Gizmo](/components/gizmo)\n```",
    },
    {
      link: "a link with a query and a fragment",
      markdown: "See [the part](/components/widget.md?plain=1#api-widget) and [Usage](?tab=code#usage).",
    },
    { link: "a link to another origin", markdown: "See [Base UI](https://base-ui.com/react/overview)." },
  ])("accepts $link", ({ markdown }) => {
    expect(catalogProblems(withWidgetSection(markdown), COMPONENTS)).toEqual([]);
  });

  it("accepts a section of exactly 50,000 characters", () => {
    expect(catalogProblems(withWidgetSection("x".repeat(50_000)), COMPONENTS)).toEqual([]);
  });
});
