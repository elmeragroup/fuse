/**
 * The `llms.txt` site index (docs-site.md §9).
 *
 * Generated at docs build from the same two inventories the SideNav renders: the authored
 * page manifest and the component pages the generation pass globbed off the route group.
 * Nothing here is hand-listed, so a new component page appears in the AI index the moment
 * its `page.mdx` lands, and its markdown endpoint is linked from the same row.
 */

import type { DocsComponent } from "../../src/lib/docs-model.ts";
import type { StaticPage } from "../../src/lib/pages.ts";
import { HOME_PAGE, staticPagesIn } from "../../src/lib/pages.ts";
import { finishMarkdown } from "./markdown.ts";

function section(title: string, rows: readonly string[]): readonly string[] {
  return [`## ${title}`, "", ...rows, ""];
}

function pageRow(page: Pick<StaticPage, "href" | "label" | "description">): string {
  return `- [${page.label}](${page.href}): ${page.description}`;
}

/** Renders the whole site index. */
export function renderLlmsTxt(components: readonly DocsComponent[]): string {
  const lines: string[] = [
    "# Fuse",
    "",
    "> The Elmera Group design system: a themed React component library covering six brands, two",
    "> segments and two variants. Every component page below has a plain-markdown twin containing",
    "> its generated API reference and the verbatim source of every demo.",
    "",
    ...section("Overview", [pageRow(HOME_PAGE), ...staticPagesIn("overview").map(pageRow)]),
    ...section("Handbook", staticPagesIn("handbook").map(pageRow)),
    ...section(
      "Components",
      components.map(
        (component) =>
          `- [${component.title}](/components/${component.slug}): ${component.lede} Markdown: ${component.markdownUrl}`
      )
    ),
  ];
  return finishMarkdown(lines);
}
