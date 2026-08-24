import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import "./ComponentSections.css";
import { InlineCode } from "./InlineCode";
import { MetaLinks } from "./MetaLinks";

export type ComponentIntroProps = {
  slug: string;
};

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
      <h1>{component.title}</h1>
      <p className="DocsLede">
        <InlineCode text={component.lede} />
      </p>
      <MetaLinks
        markdownUrl={component.markdownUrl}
        sourceUrl={component.sourceUrl}
        sourcePath={component.sourcePath}
      />
      <p className="ComponentImport">
        <code>{`import { ${component.exportName} } from "${component.entry}";`}</code>
        <span className="ComponentRsc">{component.rsc}</span>
      </p>
    </>
  );
}
