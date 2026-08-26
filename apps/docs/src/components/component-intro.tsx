import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import { DocsLede } from "./docs-lede";
import { DocsPageTitle } from "./docs-page-title";
import { DocsRscBadge } from "./docs-rsc-badge";
import { InlineCode } from "./inline-code";
import { MetaLinks } from "./meta-links";

export type ComponentIntroProps = {
  slug: string;
};

const classNames = {
  importLine:
    "flex items-center flex-wrap gap-[0.55rem] m-[1rem_0_0] [&_code]:font-docs-mono [&_code]:text-[11.5px] [&_code]:bg-docs-soft [&_code]:border [&_code]:border-docs-line [&_code]:rounded-[6px] [&_code]:py-[0.4em] [&_code]:px-[0.6em]",
} as const;

/**
 * The head of a component page (docs-site.md §3.4, items 1–2): H1, the lede from the
 * page's frontmatter, the two meta links, and the import line with the part's RSC
 * status. Authored pages open with this so the anatomy's order is one decision, not
 * eleven.
 */
export function ComponentIntro({ slug }: ComponentIntroProps): ReactElement {
  const component = requireComponent(slug);
  return (
    <>
      <DocsPageTitle>{component.title}</DocsPageTitle>
      <DocsLede>
        <InlineCode text={component.lede} />
      </DocsLede>
      <MetaLinks
        markdownUrl={component.markdownUrl}
        sourceUrl={component.sourceUrl}
        sourcePath={component.sourcePath}
      />
      <p className={classNames.importLine}>
        <code>{`import { ${component.exportName} } from "${component.entry}";`}</code>
        <DocsRscBadge rsc={component.rsc}>{component.rsc}</DocsRscBadge>
      </p>
    </>
  );
}
