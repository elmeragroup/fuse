import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import { DocsLede } from "./docs-lede";
import { DocsPageTitle } from "./docs-page-title";
import { InlineCode } from "./inline-code";
import { MetaLinks } from "./meta-links";

/** The page whose intro to render, named by its route slug. */
export type ComponentIntroProps = {
  slug: string;
};

/**
 * The head of a component page: the H1, the lede and the two meta links. Every authored
 * page opens with it, so all pages share one order. The import line and the page's RSC
 * status appear only on the markdown endpoint, and each API part shows its own RSC badge.
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
    </>
  );
}
