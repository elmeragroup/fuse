import { Children, createElement, isValidElement } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { slugifyHeading } from "../lib/slug";
import { DocsCodeBlock } from "./docs-code-block";
import { DocsInlineCode } from "./docs-inline-code";

/**
 * The element overrides `@next/mdx` applies to every authored `page.mdx`
 * (`mdx-components.tsx`). They exist for two reasons only: heading anchors, so the
 * QuickNav TOC and the rendered page agree on ids without a rehype plugin, and fenced code
 * rendered through `DocsCodeBlock` — the one highlighted code renderer (docs-site.md §8).
 */

const HEADING_LEVELS = [2, 3, 4] as const;

type HeadingLevel = (typeof HEADING_LEVELS)[number];

/**
 * The plain text of rendered children.
 *
 * Both callers need it because MDX hands markup over as a tree, not a string: a heading
 * may contain inline markup (`` `code` ``, emphasis) yet has to produce the same anchor
 * the generator recorded for the TOC, and a fenced block's text has to reach the
 * highlighter. `Children.toArray` flattens the tree and drops the empty nodes, leaving
 * strings, numbers and elements to walk.
 */
function plainText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return plainText(child.props.children);
      }
      // What is left is text, or a node with no text of its own (an iterable, a promise).
      return child instanceof Object ? "" : String(child);
    })
    .join("");
}

function mdxHeading(level: HeadingLevel) {
  const tag = `h${String(level)}`;
  function MdxHeading({ children, ...rest }: ComponentProps<"h2">): ReactElement {
    return createElement(tag, { id: slugifyHeading(plainText(children)), ...rest }, children);
  }
  MdxHeading.displayName = `Mdx${tag.toUpperCase()}`;
  return MdxHeading;
}

/** `h2`–`h4` with the anchor id the on-page TOC links to. */
export const MDX_HEADINGS = {
  h2: mdxHeading(2),
  h3: mdxHeading(3),
  h4: mdxHeading(4),
};

const LANGUAGE_CLASS = "language-";

/**
 * Inline code stays a plain element. A fenced block — which MDX marks with a
 * `language-*` class and hands over as one string — becomes a `DocsCodeBlock`, the same
 * renderer the demo frames show their source with. MDX ends a fence's text with the
 * newline before the closing backticks; stripping it keeps the block from ending on an
 * empty line.
 */
export function MdxCode({ className, children, ...rest }: ComponentProps<"code">): ReactElement {
  if (!(className ?? "").includes(LANGUAGE_CLASS)) {
    return (
      <DocsInlineCode className={className} {...rest}>
        {children}
      </DocsInlineCode>
    );
  }
  return (
    <DocsCodeBlock
      variant="standalone"
      className={className}
      source={plainText(children).replace(/\n+$/, "")}
    />
  );
}

/**
 * MDX wraps every fence in a `pre` around the `code`; `DocsCodeBlock` renders that `pre`
 * itself, so the wrapper contributes nothing and passes its children through.
 */
export function MdxPre({ children }: ComponentProps<"pre">): ReactElement {
  return <>{children}</>;
}
