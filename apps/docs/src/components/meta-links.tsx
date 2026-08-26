import type { ReactElement } from "react";

import "./meta-links.css";

export type MetaLinksProps = {
  /** The per-component markdown endpoint (docs-site.md §9). */
  markdownUrl: string;
  /** The component's source file on the repo host. */
  sourceUrl: string;
  sourcePath: string;
};

/** The §3.4 meta links that sit directly under the lede. */
export function MetaLinks({ markdownUrl, sourceUrl, sourcePath }: MetaLinksProps): ReactElement {
  return (
    <p className="MetaLinks">
      <a href={markdownUrl}>View as Markdown</a>
      <span aria-hidden="true">·</span>
      <a href={sourceUrl} title={sourcePath} rel="noreferrer">
        View source
      </a>
    </p>
  );
}
