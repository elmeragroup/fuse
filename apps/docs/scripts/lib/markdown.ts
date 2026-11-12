/**
 * The per-component markdown endpoint: the same generated API model
 * and the same extracted demo source the HTML page renders, emitted as markdown so the
 * page's **View as Markdown** link and any AI consumer read one pipeline, not two.
 */

import type { ApiSameAs } from "../../src/lib/api-same-as.ts";
import type { ApiFunction, ApiPart, DocsApiPart, DocsComponent } from "../../src/lib/docs-model.ts";
import { CLIENT_PART_NOTE, groupApiProps, propDescription } from "../../src/lib/docs-model.ts";

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

/** The API reference section, or one sentence when the page repeats another page whole. */
function renderApiReference(component: DocsComponent): string[] {
  const { alias } = component;
  if (alias !== undefined) {
    return [`\`${alias.name}\` is [\`${alias.owner}\`](${ownerMarkdownUrl(alias)}) under another name.`, ""];
  }
  return component.parts.map((part) => {
    if (part.sameAs !== undefined) return renderSameAsPart(part, part.sameAs);
    return part.function === undefined ? renderPart(part) : renderFunction(part, part.function);
  });
}

/**
 * The stylesheet an entry needs beside Fuse's own, which a consumer reading only the markdown
 * would otherwise miss. A `Map`, so `get` gives the `undefined` arm without an assertion.
 */
const ENTRY_STYLESHEETS = new Map<string, string>([
  ["@elmeragroup/fuse/chart", "@elmeragroup/fuse/chart.css"],
]);

/** One demo as a markdown section: its title, its file and its whole source. */
function renderDemo(demo: DocsComponent["demos"][number]): string[] {
  return [`### ${demo.title}`, "", `Source: \`${demo.sourcePath}\``, "", "```tsx", demo.source, "```", ""];
}

/** The Tokens consumed section, or nothing when the recipe reads no token. */
function renderTokens(component: DocsComponent): string[] {
  if (component.tokens.length === 0) return [];
  return [
    "## Tokens consumed",
    "",
    ...component.tokens.map((token) => `- \`${token.name}\`${token.isColor ? " (colour)" : ""}`),
    "",
  ];
}

/**
 * The endpoint of a page in the Usage-and-Examples shape. It follows the page with the H1 and
 * lede, the Usage code, every example with its whole source, the API reference and the tokens.
 */
function renderUsagePage(component: DocsComponent, usage: string): string {
  return finishMarkdown([
    `# ${component.title}`,
    "",
    component.lede,
    "",
    "## Usage",
    "",
    "```tsx",
    usage,
    "```",
    "",
    "## Examples",
    "",
    ...component.demos.flatMap((demo) => renderDemo(demo)),
    "## API reference",
    "",
    ...renderApiReference(component),
    ...renderTokens(component),
  ]);
}

/** Renders one component's markdown endpoint. */
export function renderComponentMarkdown(component: DocsComponent): string {
  if (component.usage !== null) return renderUsagePage(component, component.usage);
  // The stylesheet belongs to the page's own entry; an extra entry styles through it.
  const stylesheet = ENTRY_STYLESHEETS.get(component.apis[0].entry);
  const lines: string[] = [
    `# ${component.title}`,
    "",
    component.lede,
    "",
    ...(component.intro === "" ? [] : [component.intro, ""]),
    // One import line per entry the API reference documents, the page's own first.
    ...component.apis.map(({ entry }) => `- Import: \`import { ... } from "${entry}";\``),
    ...(stylesheet === undefined
      ? []
      : [`- Stylesheet: \`import "${stylesheet}";\`, once, beside Fuse's own`]),
    `- RSC: ${component.rsc}${component.rsc === "client" ? `. ${CLIENT_PART_NOTE}` : ""}`,
    `- Source: \`${component.sourcePath}\``,
    "",
    "## Demos",
    "",
  ];
  lines.push(...component.demos.flatMap((demo) => renderDemo(demo)));
  lines.push("## API reference", "", ...renderApiReference(component), ...renderTokens(component));
  return finishMarkdown(lines);
}
