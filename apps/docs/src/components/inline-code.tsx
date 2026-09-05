import { Fragment } from "react";
import type { ReactElement } from "react";

import { DocsInlineCode } from "./docs-inline-code";

export type InlineCodeProps = {
  text: string;
};

/**
 * Renders the one piece of markdown that reaches the page as plain strings: inline
 * code spans in a frontmatter lede and in JSDoc prop descriptions. Both come from
 * sources written as markdown, so backticks would otherwise render literally.
 */
export function InlineCode({ text }: InlineCodeProps): ReactElement {
  const segments = text.split("`");
  return (
    <>
      {segments.map((segment, index) => (
        // Segments are positional, so the index is the identity.
        <Fragment key={`${String(index)}:${segment}`}>
          {index % 2 === 1 ? <DocsInlineCode>{segment}</DocsInlineCode> : segment}
        </Fragment>
      ))}
    </>
  );
}
