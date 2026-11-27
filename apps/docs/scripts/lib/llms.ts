/**
 * The `llms.txt` site index.
 *
 * Generated at docs build from the inventories the SideNav and the studio render: the authored
 * page manifest, the studio page manifest and the component pages the generation pass globbed
 * off the route group.
 * Nothing here is hand-listed, so a new component page appears in the AI index the moment
 * its `page.mdx` lands, and its markdown endpoint is linked from the same row. An authored page
 * written as `page.mdx` links its markdown endpoint the same way.
 */

import type { DocsComponent } from "../../src/lib/docs-model.ts";
import type { StaticPage } from "../../src/lib/pages.ts";
import { HOME_PAGE, staticPagesIn } from "../../src/lib/pages.ts";
import { STUDIO_PAGES } from "../../src/studio/registration.ts";
import { finishMarkdown } from "./markdown.ts";

function section(title: string, rows: readonly string[]): readonly string[] {
  return [`## ${title}`, "", ...rows, ""];
}

function pageRow(page: Pick<StaticPage, "href" | "label" | "description">): string {
  return `- [${page.label}](${page.href}): ${page.description}`;
}

/**
 * Renders the whole site index.
 *
 * @param components - Every component page, in route order.
 * @param markdownPages - The href of each authored page that has a markdown endpoint.
 * @returns The `llms.txt` text.
 */
export function renderLlmsTxt(
  components: readonly DocsComponent[],
  markdownPages: ReadonlySet<string>
): string {
  const authoredRow = (page: StaticPage): string =>
    markdownPages.has(page.href) ? `${pageRow(page)} Markdown: ${page.href}.md` : pageRow(page);
  const lines: string[] = [
    "# Fuse",
    "",
    "> The Elmera Group design system: a themed React component library covering seven brands, two",
    "> segments and two identities. Every component page below has a plain-markdown twin containing",
    "> its generated API reference and the verbatim source of every demo. Each other page whose row",
    "> names a Markdown link has a twin too.",
    "",
    ...section("Overview", [pageRow(HOME_PAGE), ...staticPagesIn("overview").map(authoredRow)]),
    ...section("Handbook", staticPagesIn("handbook").map(authoredRow)),
    ...section(
      "Studio",
      STUDIO_PAGES.map((page) => pageRow({ ...page, label: page.title }))
    ),
    ...section(
      "Components",
      components.map(
        (component) =>
          `- [${component.title}](/components/${component.slug}): ${component.lede} Markdown: ${component.markdownUrl}`
      )
    ),
    ...section("Blocks", staticPagesIn("blocks").map(authoredRow)),
  ];
  return finishMarkdown(lines);
}
