import { describe, expect, it } from "vitest";

import type { CatalogDocument } from "@elmeragroup/docs-catalog";

import { buildIndex, search } from "../src/search.ts";
import { catalog } from "./fixtures.ts";

// Unit under test: the search ranking. Oracle: hand-written expectations over the fixture
// catalog. A query that names a page lands on its lead section, the words beyond the title pick
// the section, a word that asks for the API picks an API part, and equal scores keep catalog order.

const index = buildIndex(catalog.documents);

const hrefs = (query: string, limit = 8) => search(index, query, limit).map((hit) => hit.href);

/** A page with one section per markdown body, each under a heading of its own. */
function page(href: string, ...bodies: readonly string[]): CatalogDocument {
  return {
    href,
    title: href.slice(1),
    group: "Components",
    description: "",
    keywords: [],
    sections: bodies.map((body, at) => ({
      id: `part-${String(at + 1)}`,
      depth: 2,
      markdown: `## Part ${String(at + 1)}\n\n${body}`,
    })),
  };
}

describe("search", () => {
  it("lands on the lead section of the page a query names", () => {
    expect(hrefs("select", 1)).toEqual(["/components/select#overview"]);
  });

  it("picks the section that matches the words beyond the title", () => {
    expect(hrefs("button pending", 1)).toEqual(["/components/button#pending"]);
    expect(hrefs("button disabled", 1)).toEqual(["/components/button#disabled"]);
  });

  it("picks an API part when the query asks for a prop", () => {
    expect(hrefs("button pending prop", 1)).toEqual(["/components/button#api-button"]);
    expect(hrefs("select onValueChange", 1)).toEqual(["/components/select#api-select-root"]);
  });

  it("finds a page from a description in other forms of its words", () => {
    expect(hrefs("picking options from lists", 1)).toEqual(["/components/select#overview"]);
  });

  it("finds the quick start for setting up, though it has no sections", () => {
    expect(hrefs("how do I set up fuse", 1)).toEqual(["/quick-start"]);
  });

  it("returns one hit per page and nothing for a query without terms", () => {
    expect(hrefs("button")).toEqual(["/components/button#overview"]);
    expect(hrefs("the and of")).toEqual([]);
  });

  it("keeps catalog order between pages that score the same", () => {
    const twin = (href: string): CatalogDocument => ({
      href,
      title: "Twin",
      group: "Components",
      description: "Same text.",
      keywords: [],
      sections: [{ id: "overview", depth: 2, markdown: "# Twin\n\nSame text." }],
    });
    const twins = buildIndex([twin("/b"), twin("/a")]);
    expect(search(twins, "twin", 2).map((hit) => hit.href)).toEqual(["/b#overview", "/a#overview"]);
  });

  it("shows a title with the section heading and an excerpt around the match", () => {
    expect(search(index, "button disabled", 1)).toEqual([
      {
        title: "Button › Disabled",
        href: "/components/button#disabled",
        excerpt: "A disabled button ignores presses.",
        missing: [],
      },
    ]);
  });

  it.each([
    { query: "Pending Buttons with themes", href: "/components/button#pending", missing: ["themes"] },
    { query: "button getting started", href: "/components/button#overview", missing: ["getting started"] },
    { query: "set up a kanban board", href: "/quick-start", missing: ["kanban", "board"] },
  ])("names the words $missing, as written, that the hit for $query lacks", ({ query, href, missing }) => {
    const hit = search(index, query, 8).find((candidate) => candidate.href === href);
    expect(hit?.missing).toEqual(missing);
  });

  it("cuts an excerpt to 300 characters around the word that matched", () => {
    const long: CatalogDocument = {
      href: "/long",
      title: "Long",
      group: "Components",
      description: "",
      keywords: [],
      sections: [
        {
          id: "overview",
          depth: 2,
          markdown: `# Long\n\n${"filler ".repeat(100)}needle ${"after ".repeat(100)}`,
        },
      ],
    };
    const [hit] = search(buildIndex([long]), "needle", 1);
    const excerpt = hit?.excerpt ?? "";
    expect(excerpt.length).toBeLessThanOrEqual(300);
    expect(excerpt).toContain("needle");
  });

  it("keeps the match in the excerpt when it ends a long token with no space", () => {
    // A path of 102 characters, which the excerpt cannot open at a space before the match.
    const path = page("/path", `Starts here. ${"segment/".repeat(12)}needle ends.`);
    expect(search(buildIndex([path]), "needle", 1).map((hit) => hit.excerpt)).toEqual([
      `…${"segment/".repeat(10)}needle ends.`,
    ]);
  });

  it.each([
    { form: "an indented backtick fence", open: "   ```tsx", close: "   ```", newline: "\n" },
    { form: "a tilde fence", open: "~~~tsx", close: "~~~", newline: "\n" },
    {
      form: "a three-backtick fence shown inside a four-backtick one",
      open: "````markdown\n```tsx",
      close: "```\n````",
      newline: "\n",
    },
    { form: "a fence in CRLF text", open: "```tsx", close: "```", newline: "\r\n" },
  ])("ranks a prose mention above code in $form", ({ open, close, newline }) => {
    const markdown = `Shows a call.\n\n${open}\nneedle(); needle(); needle();\n${close}`;
    const code = page("/code", markdown.replaceAll("\n", newline));
    const prose = page("/prose", "Pass a needle to sew with, among other things a seam can hold.");
    expect(search(buildIndex([code, prose]), "needle", 2).map((hit) => hit.href)).toEqual([
      "/prose#part-1",
      "/code#part-1",
    ]);
  });

  it("cuts the excerpt from the code when only the code holds the query", () => {
    const code = page("/code", "Shows a call.\n\n```tsx\nthreadNeedle();\n```");
    expect(search(buildIndex([code]), "needle", 1).map((hit) => hit.excerpt)).toEqual(["threadNeedle();"]);
  });

  it.each([
    {
      inside: "onOpenChangeComplete",
      longer:
        "`onOpenChangeComplete` runs once an open change completes: after the open animation, the change ends.",
    },
    {
      inside: "menuOnOpenChange",
      longer:
        "`menuOnOpenChange` runs once an open change completes: after the open animation, the change ends.",
    },
  ])("matches an identifier whole, not inside $inside", ({ longer }) => {
    const menu = page(
      "/menu",
      longer,
      "`onOpenChange` runs when a press or a key asks the menu to open or close, before any animation starts."
    );
    expect(search(buildIndex([menu]), "onOpenChange", 1).map((hit) => hit.href)).toEqual(["/menu#part-2"]);
  });

  it("centers an identifier's excerpt on the identifier whole, not on a longer one before it", () => {
    const dialog = page(
      "/dialog",
      `Starts with \`onOpenChangeComplete\`. ${"filler ".repeat(80)}The exact prop is \`onOpenChange\`.`
    );
    expect(search(buildIndex([dialog]), "onOpenChange", 1)[0]?.excerpt).toContain(
      "The exact prop is `onOpenChange`."
    );
  });

  it("centers a partial identifier's excerpt on the identifier that starts with it", () => {
    const dialog = page(
      "/dialog",
      `Set \`defaultOpen\` to start open. ${"filler ".repeat(80)}Then \`onOpenChange\` runs.`
    );
    expect(search(buildIndex([dialog]), "onOpen", 1)[0]?.excerpt).toContain("Then `onOpenChange` runs.");
  });

  it.each([
    { body: "Ignores presses.", excerpt: "Ignores presses." },
    { body: "", excerpt: "Shows a needle." },
  ])("cuts a heading match's excerpt from the prose, else the description: $excerpt", ({ body, excerpt }) => {
    const headed: CatalogDocument = {
      href: "/headed",
      title: "Headed",
      group: "Components",
      description: "Shows a needle.",
      keywords: [],
      sections: [{ id: "needle", depth: 2, markdown: `## Needle\n\n${body}` }],
    };
    expect(search(buildIndex([headed]), "needle", 1).map((hit) => hit.excerpt)).toEqual([excerpt]);
  });

  it.each([
    { query: "entries", text: "Each entry has a key." },
    { query: "boxes", text: "Draws a box." },
    { query: "selected", text: "Selecting a row." },
  ])("finds $query in $text through the shared stem", ({ query, text }) => {
    expect(search(buildIndex([page("/stem", text)]), query, 1).map((hit) => hit.href)).toEqual([
      "/stem#part-1",
    ]);
  });
});
