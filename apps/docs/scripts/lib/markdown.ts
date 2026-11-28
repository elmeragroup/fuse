/**
 * The per-component markdown endpoint: the same generated API model
 * and the same extracted demo source the HTML page renders, emitted as markdown so the
 * page's **View as Markdown** link and any AI consumer read one pipeline, not two.
 *
 * A page is rendered as ordered catalog sections, split at the headings the site anchors, and
 * the endpoint is those sections joined. The docs catalog holds the same sections, so the
 * endpoint and the catalog cannot differ.
 */

import type { CatalogSection } from "@elmeragroup/docs-catalog";

import {
  API_SECTION_ID,
  apiPartAnchor,
  apiPropAnchor,
  OVERVIEW_SECTION_ID,
  TOKENS_SECTION_ID,
} from "../../src/lib/anchors.ts";
import type { ApiSameAs } from "../../src/lib/api-same-as.ts";
import type { ApiFunction, ApiPart, DocsApiPart, DocsComponent } from "../../src/lib/docs-model.ts";
import { groupApiProps, propDescription } from "../../src/lib/docs-model.ts";

/**
 * Turns accumulated lines into a finished markdown document: collapsed blank runs, no
 * trailing whitespace, exactly one closing newline. Every markdown artifact the docs
 * build writes ends here, so the endpoints and `llms.txt` cannot differ in shape.
 */
export function finishMarkdown(lines: readonly string[]): string {
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

/**
 * A markdown table, its cells escaped so a pipe or a line break cannot end a cell early.
 *
 * @param header - The column names.
 * @param rows - One array of markdown cells per row, in column order.
 * @returns The table's lines joined, without a closing newline.
 */
export function markdownTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.map(escapeCell).join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

/**
 * One compound part. RSC status is a per-part fact, so it rides on the heading as a badge
 * — the markdown twin of the HTML page's part-header indicator — and
 * the prop table does not repeat it down a column.
 */
function renderPart(part: ApiPart): string {
  const lines: string[] = [`### ${part.name} · RSC: ${part.rsc}`, "", `Source: \`${part.sourcePath}\``, ""];
  if (part.props.length === 0) {
    lines.push("No own props — every prop is forwarded.", "");
  } else {
    for (const group of groupApiProps(part.props)) {
      if (group.label !== null) lines.push(`#### ${group.label}`, "");
      lines.push("| Prop | Type | Default | Required | Description |", "| --- | --- | --- | --- | --- |");
      for (const prop of group.props) {
        lines.push(
          `| \`${prop.name}\` | \`${escapeCell(prop.type)}\` | ${
            prop.defaultValue === null ? "—" : `\`${escapeCell(prop.defaultValue)}\``
          } | ${prop.required ? "yes" : "no"} | ${escapeCell(propDescription(prop))} |`
        );
      }
      lines.push("");
    }
  }
  if (part.forwardedCount > 0) {
    lines.push(
      `Plus ${String(part.forwardedCount)} forwarded props from ${part.forwardedFrom
        .map((name) => `\`${name}\``)
        .join(", ")}.`,
      ""
    );
  }
  return lines.join("\n");
}

/** The owner page's markdown endpoint, which a repeated part links to. */
function ownerMarkdownUrl(owner: { readonly slug: string }): string {
  return `/components/${owner.slug}.md`;
}

/** A repeated part's one line in place of its prop table. */
function renderSameAsPart(part: DocsApiPart, owner: ApiSameAs): string {
  return [
    `### ${part.name}`,
    "",
    `\`${part.name}\` is [\`${owner.name}\`](${ownerMarkdownUrl(owner)}).`,
    "",
  ].join("\n");
}

/** A function part's signature, parameters and return value. */
function renderFunction(part: DocsApiPart, reference: ApiFunction): string {
  const lines = [
    `### ${part.name} · RSC: ${part.rsc}`,
    "",
    `Source: \`${part.sourcePath}\``,
    "",
    "```ts",
    reference.signature,
    "```",
    "",
    reference.description,
    "",
  ];
  if (reference.parameters.length > 0) {
    lines.push("| Parameter | Type | Description |", "| --- | --- | --- |");
    for (const parameter of reference.parameters) {
      lines.push(
        `| \`${parameter.name}${parameter.optional ? "?" : ""}\` | \`${escapeCell(parameter.type)}\` | ${escapeCell(parameter.description)} |`
      );
    }
    lines.push("");
  }
  const returns = reference.returns.description === "" ? "" : ` ${reference.returns.description}`;
  lines.push(`Returns \`${reference.returns.type}\`.${returns}`, "");
  return lines.join("\n");
}

/**
 * One catalog section from its lines. Blank runs collapse as {@link finishMarkdown} collapses
 * them, and the blank lines at either edge go, because {@link joinSections} puts one blank line
 * between sections.
 *
 * @param id - The anchor the site gives the section's heading.
 * @param depth - 2 for the lead section and a second-level heading, 3 for a heading under one.
 * @param lines - The heading and the text up to the next section.
 * @returns The section.
 */
export function catalogSection(
  id: string,
  depth: CatalogSection["depth"],
  lines: readonly string[]
): CatalogSection {
  const markdown = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
  return { id, depth, markdown };
}

/** The API reference sections: the heading, with one sentence on an alias page, then one section per part. */
function apiReferenceSections(component: DocsComponent): CatalogSection[] {
  const { alias } = component;
  if (alias !== undefined) {
    return [
      catalogSection(API_SECTION_ID, 2, [
        "## API reference",
        "",
        `\`${alias.name}\` is [\`${alias.owner}\`](${ownerMarkdownUrl(alias)}) under another name.`,
      ]),
    ];
  }
  return [
    catalogSection(API_SECTION_ID, 2, ["## API reference"]),
    ...component.parts.map((part) => {
      const markdown =
        part.sameAs !== undefined
          ? renderSameAsPart(part, part.sameAs)
          : part.function === undefined
            ? renderPart(part)
            : renderFunction(part, part.function);
      return catalogSection(apiPartAnchor(part.name), 3, [markdown]);
    }),
  ];
}

/**
 * The anchor id of every prop row the page's API reference renders: one per own prop of each part
 * that is neither a function nor another page's part, as {@link apiReferenceSections} prints them.
 *
 * @param component - The component page.
 * @returns The row ids, empty on an alias page.
 */
export function componentPropAnchors(component: DocsComponent): ReadonlySet<string> {
  if (component.alias !== undefined) return new Set();
  return new Set(
    component.parts
      .filter((part) => part.sameAs === undefined && part.function === undefined)
      .flatMap((part) => part.props.map((prop) => apiPropAnchor(part.name, prop.name)))
  );
}

/**
 * One demo as a markdown section at the page's heading level: its title, file and whole source.
 * The source's fence is one backtick longer than the longest backtick run in it, and at least
 * three, so no line of the source can close it.
 *
 * @param demo - The demo's title, repo-relative file and source.
 * @param depth - The level of the demo's heading on the page.
 * @returns The section's lines.
 */
export function renderDemo(
  demo: Pick<DocsComponent["demos"][number], "title" | "sourcePath" | "source">,
  depth: number
): string[] {
  const longest = Math.max(0, ...(demo.source.match(/`+/gu) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [
    `${"#".repeat(depth)} ${demo.title}`,
    "",
    `Source: \`${demo.sourcePath}\``,
    "",
    `${fence}tsx`,
    demo.source,
    fence,
  ];
}

/** The Tokens consumed section, or none when the recipe reads no token. */
function tokenSections(component: DocsComponent): CatalogSection[] {
  if (component.tokens.length === 0) return [];
  return [
    catalogSection(TOKENS_SECTION_ID, 2, [
      "## Tokens consumed",
      "",
      ...component.tokens.map((token) => `- \`${token.name}\`${token.isColor ? " (colour)" : ""}`),
    ]),
  ];
}

/**
 * The catalog depth of an authored heading. The page reader admits only the Usage shape's `##`
 * headings, so a deeper one here means that reader changed without this function.
 */
function headingDepth(depth: number): CatalogSection["depth"] {
  if (depth === 2 || depth === 3) return depth;
  throw new Error(`a component page heading has depth ${String(depth)}; the catalog holds depths 2 and 3`);
}

/**
 * The page's headings and demos in page order, one section each. A demo prints at its heading
 * level with its source, the Usage heading carries the Usage code, and the Composition heading its
 * markdown. Every other heading is a section of its own, even with nothing under it, because the
 * page renders it and its anchor: Examples on a page with no titled demo is one.
 */
function pageSections(component: DocsComponent): CatalogSection[] {
  const demos = new Map(component.demos.map((demo) => [demo.id, demo]));
  const { sections, usage, composition } = component;
  return sections.flatMap((section): CatalogSection[] => {
    if (section.kind === "demo") {
      const demo = demos.get(section.id);
      return demo === undefined
        ? []
        : [catalogSection(section.id, section.depth, renderDemo(demo, section.depth))];
    }
    const depth = headingDepth(section.depth);
    const heading = [`${"#".repeat(depth)} ${section.title}`, ""];
    if (section.id === "usage")
      return [catalogSection(section.id, depth, [...heading, "```tsx", usage, "```"])];
    if (section.id === "composition" && composition !== null) {
      return [catalogSection(section.id, depth, [...heading, composition])];
    }
    return [catalogSection(section.id, depth, heading)];
  });
}

/** The import line of one entry the API reference documents. */
function importLine({ entry }: { readonly entry: string }): string {
  return `- Import: \`import { ... } from "${entry}";\``;
}

/**
 * One component's page as ordered catalog sections: the lead section with the H1, the lede and
 * the import of each extra entry, the page's sections in page order, the API reference and its
 * parts, and the tokens. The Usage code imports only the page's own entry, so the lead section
 * lists the import of each extra entry, such as `@elmeragroup/fuse/command-virtual` on the
 * Command page.
 */
export function componentSections(component: DocsComponent): readonly CatalogSection[] {
  return [
    catalogSection(OVERVIEW_SECTION_ID, 2, [
      `# ${component.title}`,
      "",
      component.lede,
      "",
      ...component.apis.slice(1).map(importLine),
    ]),
    ...pageSections(component),
    ...apiReferenceSections(component),
    ...tokenSections(component),
  ];
}

/** The markdown endpoint of a page: its sections in order, one blank line apart. */
export function joinSections(sections: readonly CatalogSection[]): string {
  return `${sections.map((section) => section.markdown).join("\n\n")}\n`;
}
