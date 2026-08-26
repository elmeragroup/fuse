import type { ReactElement } from "react";

export type MetaLinksProps = {
  /** The per-component markdown endpoint (docs-site.md §9). */
  markdownUrl: string;
  /** The component's source file on the repo host. */
  sourceUrl: string;
  sourcePath: string;
};

const classNames = {
  root: "flex items-center gap-[0.55rem] m-[0.9rem_0_0] text-[0.8rem] text-docs-sub [&_a]:text-docs-sub [&_a]:no-underline [&_a]:border-b [&_a]:border-docs-line [&_a:hover]:text-docs-ink [&_a:hover]:border-current",
} as const;

/** The §3.4 meta links that sit directly under the lede. */
export function MetaLinks({ markdownUrl, sourceUrl, sourcePath }: MetaLinksProps): ReactElement {
  return (
    <p className={classNames.root}>
      <a href={markdownUrl}>View as Markdown</a>
      <span aria-hidden="true">·</span>
      <a href={sourceUrl} title={sourcePath} rel="noreferrer">
        View source
      </a>
    </p>
  );
}
