/**
 * The per-component markdown endpoint: the same generated API model
 * and the same extracted demo source the HTML page renders, emitted as markdown so the
 * page's **View as Markdown** link and any AI consumer read one pipeline, not two.
 */

import type { ApiPart, DocsComponent } from "../../src/lib/docs-model.ts";
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
  return finishMarkdown(lines);
}
