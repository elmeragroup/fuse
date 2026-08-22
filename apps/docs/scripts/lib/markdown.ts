/**
 * The per-component markdown endpoint (docs-site.md §9): the same generated API model
 * and the same extracted demo source the HTML page renders, emitted as markdown so the
 * page's **View as Markdown** link and any AI consumer read one pipeline, not two.
 */

import type { ApiPart, DocsComponent } from "../../src/lib/docs-model.ts";
import { propDescription } from "../../src/lib/docs-model.ts";

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

function renderPart(part: ApiPart): string {
  const lines: string[] = [`### ${part.name}`, "", `Source: \`${part.sourcePath}\``, ""];
  if (part.props.length === 0) {
    lines.push("No own props — every prop is forwarded.", "");
  } else {
    lines.push(
      "| Prop | Type | Default | Required | RSC | Description |",
      "| --- | --- | --- | --- | --- | --- |"
    );
    for (const prop of part.props) {
      lines.push(
        `| \`${prop.name}\` | \`${escapeCell(prop.type)}\` | ${
          prop.defaultValue === null ? "—" : `\`${escapeCell(prop.defaultValue)}\``
        } | ${prop.required ? "yes" : "no"} | ${part.rsc} | ${escapeCell(propDescription(prop))} |`
      );
    }
    lines.push("");
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

/** Renders one component's markdown endpoint. */
export function renderComponentMarkdown(component: DocsComponent): string {
  const lines: string[] = [
    `# ${component.title}`,
    "",
    component.lede,
    "",
    `- Import: \`import { ... } from "${component.entry}";\``,
    `- RSC: ${component.rsc}`,
    `- Source: \`${component.sourcePath}\``,
    "",
    "## Demos",
    "",
  ];
  for (const demo of component.demos) {
    lines.push(
      `### ${demo.title}`,
      "",
      `Source: \`${demo.sourcePath}\``,
      "",
      "```tsx",
      demo.source,
      "```",
      ""
    );
  }
  lines.push("## API reference", "");
  for (const part of component.parts) {
    lines.push(renderPart(part));
  }
  if (component.tokens.length > 0) {
    lines.push("## Tokens consumed", "");
    for (const token of component.tokens) {
      lines.push(`- \`${token.name}\`${token.isColor ? " (colour)" : ""}`);
    }
    lines.push("");
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}
