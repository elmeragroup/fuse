import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

export type MetaLinksProps = {
  /** The per-component markdown endpoint (docs-site.md §9). */
  markdownUrl: string;
  /** The component's source file on the repo host. */
  sourceUrl: string;
  sourcePath: string;
};

const metaLinks = tv({
  slots: {
    root: "text-sm m-[0.9rem_0_0] flex items-center gap-2 text-muted-foreground [&_a]:border-b [&_a]:border-border [&_a]:text-muted-foreground [&_a]:no-underline [&_a:hover]:border-current [&_a:hover]:text-foreground",
  },
});

const { root } = metaLinks();

/** The §3.4 meta links that sit directly under the lede. */
export function MetaLinks({ markdownUrl, sourceUrl, sourcePath }: MetaLinksProps): ReactElement {
  return (
    <p className={root()}>
      <a href={markdownUrl}>View as Markdown</a>
      <span aria-hidden="true">·</span>
      <a href={sourceUrl} title={sourcePath} rel="noreferrer">
        View source
      </a>
    </p>
  );
}
