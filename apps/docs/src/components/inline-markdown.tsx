import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { DocsInlineCode } from "./docs-inline-code";

const link = tv({ base: "border-b border-border no-underline hover:border-current" });

/**
 * A code span, or a link whose target is a site path or an http(s) URL. The scan runs left to
 * right, so a code span that contains `[Quick start](/quick-start)` stays code. Link text holds
 * no brackets outside its code spans, so it cannot hold another link. A site path starts with
 * one `/` and no second slash or backslash; any other target, such as `//example.com`,
 * `/\example.com` or `javascript:`, leaves the brackets as text.
 */
const TOKEN = /`([^`]*)`|\[((?:[^[\]`]|`[^`]*`)*)\]\(((?:\/(?![/\\])|https?:\/\/)[^\s)]*)\)/g;

type InlineMarkdownProps = {
  text: string;
};

/**
 * Renders the code spans and links in a frontmatter lede or a JSDoc description. Both reach the
 * page as plain strings written in markdown, so backticks and `[text](href)` would otherwise
 * render literally.
 */
export function InlineMarkdown({ text }: InlineMarkdownProps): ReactElement {
  const nodes: ReactNode[] = [];
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, code, label, href] = match;
    nodes.push(text.slice(index, match.index));
    if (code !== undefined) {
      nodes.push(<DocsInlineCode key={match.index}>{code}</DocsInlineCode>);
    } else if (label !== undefined && href !== undefined) {
      nodes.push(
        <a
          key={match.index}
          className={link()}
          href={href}
          rel={href.startsWith("/") ? undefined : "noreferrer"}>
          <InlineMarkdown text={label} />
        </a>
      );
    }
    index = match.index + whole.length;
  }
  nodes.push(text.slice(index));
  return <>{nodes}</>;
}
