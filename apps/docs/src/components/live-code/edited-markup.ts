/**
 * The Code view's highlighted markup with the stage edits written in, without a highlighter on the
 * client (`test/client-graph.test.ts` keeps sugar-high off the client graph).
 *
 * The server's sugar-high markup is one span per token inside one span per line, with a `\n` text
 * node between lines, so its text is the source itself and a source offset names a point in it.
 * The serializer's own replacements (`sourceEdits`) apply here at their offsets, so the markup
 * reads exactly as the text Copy writes. An attribute an edit writes is drawn as sugar-high draws
 * one, tinted so the reader sees what changed.
 */

import { tv } from "tailwind-variants";

import type { SourceEdit } from "../../lib/live-code/edits";

/**
 * The colours of the tokens an edit writes, through the theme's `sh` colours, and the tint on the
 * attribute it wrote, so the reader sees what changed.
 */
const editedTokens = tv({
  slots: { attribute: "rounded-sm bg-primary/10", token: "" },
  variants: {
    type: {
      space: {},
      property: { token: "text-sh-property" },
      sign: { token: "text-sh-sign" },
      string: { token: "text-sh-string" },
      keyword: { token: "text-sh-keyword" },
    },
  },
});

/** A token type sugar-high writes for attribute text. */
type TokenType = "space" | "property" | "sign" | "string" | "keyword";

/** One token, classed as sugar-high classes its own, and coloured by the theme. */
function token(type: TokenType, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `sh__token--${type} ${editedTokens({ type }).token()}`.trim();
  span.textContent = text;
  return span;
}

/**
 * The tokens of the attribute text an edit writes: spaces, a name, and for a value `=` and the
 * quoted string or `{false}`, as `attributeText` spells them.
 */
function attributeTokens(text: string): readonly Node[] {
  const tokens: Node[] = [];
  for (const [, space, name, value] of text.matchAll(/(\s+)|([^\s=]+)(?:=(\S+))?/gu)) {
    if (space !== undefined) {
      tokens.push(token("space", space));
      continue;
    }
    const attribute = document.createElement("span");
    attribute.className = editedTokens().attribute();
    attribute.append(token("property", name ?? ""));
    if (value !== undefined) {
      attribute.append(token("sign", "="));
      if (value.startsWith("{"))
        attribute.append(token("sign", "{"), token("keyword", value.slice(1, -1)), token("sign", "}"));
      else attribute.append(token("string", value));
    }
    tokens.push(attribute);
  }
  return tokens;
}

/** Where a source offset falls in the markup: a text node and the offset inside it. */
function pointAt(
  texts: readonly { readonly node: Text; readonly start: number }[],
  offset: number
): [Text, number] | null {
  // The last text node starting at or before the offset holds it; at a boundary that is the node
  // the offset ends, so an insertion joins the token before it rather than opening the next line.
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const entry = texts[index];
    if (entry !== undefined && entry.start <= offset && (entry.start < offset || index === 0)) {
      return [entry.node, offset - entry.start];
    }
  }
  return null;
}

/**
 * Writes source replacements into sugar-high markup of the same source.
 *
 * @param html - The server's markup of the original source.
 * @param edits - Replacements indexing the original source, as `sourceEdits` returns them.
 * @returns The markup of the edited source.
 */
export function editedMarkup(html: string, edits: readonly SourceEdit[]): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;
  const texts: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let length = 0;
  for (let node = walker.nextNode(); node instanceof Text; node = walker.nextNode()) {
    texts.push({ node, start: length });
    length += node.data.length;
  }
  // Back to front, so the offsets of the edits still to come hold.
  for (const { start, end, text } of edits.toSorted((left, right) => right.start - left.start)) {
    const from = pointAt(texts, start);
    const to = pointAt(texts, end);
    if (from === null || to === null) continue;
    const range = document.createRange();
    range.setStart(...from);
    range.setEnd(...to);
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    fragment.append(...attributeTokens(text));
    range.insertNode(fragment);
  }
  // A removal that took a line's `\n` joins that line to the one before, as in the text.
  for (const line of root.querySelectorAll(".sh__line")) {
    const previous = line.previousSibling;
    if (previous instanceof Element && previous.classList.contains("sh__line")) {
      previous.append(...line.childNodes);
      line.remove();
    }
  }
  const out = document.createElement("div");
  out.append(root);
  return out.innerHTML;
}
