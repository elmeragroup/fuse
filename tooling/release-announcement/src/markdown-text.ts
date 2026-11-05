/**
 * The text of Markdown nodes without their markup: what a heading's title is compared by, and how
 * content nested too deep to render as nested is shown. One projection serves every caller, and it
 * names every mdast node type, so a node kind added to mdast cannot drop out of the text unseen.
 */

import { Match } from "effect";
import type { Nodes } from "mdast";

/** What a node adds to the text: its own text, or its children, separated or run together. */
type Projection =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "Children"; readonly children: readonly Nodes[]; readonly separated: boolean };

const text = (value: string): Projection => ({ _tag: "Text", text: value });
const inline = (children: readonly Nodes[]): Projection => ({ _tag: "Children", children, separated: false });
const blocks = (children: readonly Nodes[]): Projection => ({ _tag: "Children", children, separated: true });

/**
 * One node's part of the text. Blocks are separated by a space and inline content runs together,
 * as it reads; a line break is a space, and an image is its alt text, or nothing without one, as
 * CommonMark renders an image's text. Definitions and thematic breaks show nothing.
 */
const projection = Match.type<Nodes>().pipe(
  Match.discriminatorsExhaustive("type")({
    root: (node) => blocks(node.children),
    blockquote: (node) => blocks(node.children),
    list: (node) => blocks(node.children),
    listItem: (node) => blocks(node.children),
    footnoteDefinition: (node) => blocks(node.children),
    table: (node) => blocks(node.children),
    tableRow: (node) => blocks(node.children),
    paragraph: (node) => inline(node.children),
    heading: (node) => inline(node.children),
    tableCell: (node) => inline(node.children),
    emphasis: (node) => inline(node.children),
    strong: (node) => inline(node.children),
    delete: (node) => inline(node.children),
    link: (node) => inline(node.children),
    linkReference: (node) => inline(node.children),
    text: (node) => text(node.value),
    inlineCode: (node) => text(node.value),
    code: (node) => text(node.value),
    html: (node) => text(node.value),
    yaml: (node) => text(node.value),
    break: () => text(" "),
    image: (node) => text(node.alt ?? ""),
    imageReference: (node) => text(node.alt ?? ""),
    footnoteReference: (node) => text(`[^${node.identifier}]`),
    definition: () => text(""),
    thematicBreak: () => text(""),
  })
);

/**
 * A node's text without markup, as one line with its whitespace collapsed. It is read with an
 * explicit stack, so a node of any depth is read.
 *
 * @param node - The node.
 * @returns Its text.
 */
export function textOf(node: Nodes): string {
  const parts: string[] = [];
  const pending: (Nodes | " ")[] = [node];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === " ") {
      parts.push(" ");
      continue;
    }
    const part = projection(next);
    if (part._tag === "Text") {
      parts.push(part.text);
      continue;
    }
    for (let index = part.children.length - 1; index >= 0; index -= 1) {
      const child = part.children[index];
      if (child !== undefined) pending.push(child);
      if (part.separated && index > 0) pending.push(" ");
    }
  }
  return parts.join("").replaceAll(/\s+/gu, " ").trim();
}
