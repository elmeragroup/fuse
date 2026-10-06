import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { ogDocsPath, ogMetadata } from "../lib/og-metadata";
import { requireStaticPage } from "../lib/pages";
import { DocsLede } from "./docs-lede";
import { DocsPageTitle } from "./docs-page-title";
import { DocsProse } from "./docs-prose";

/**
 * Page metadata for an authored Overview/Handbook route.
 *
 * Title and description come from the same manifest entry the SideNav and the generated
 * `llms.txt` index read, so the three can never describe a page differently. The card points at
 * the page's image under `/og/docs`.
 */
export function pageMetadata(href: string): Metadata {
  const page = requireStaticPage(href);
  return {
    title: page.label,
    description: page.description,
    ...ogMetadata({
      image: ogDocsPath(href),
      alt: `Fuse: ${page.label}`,
    }),
  };
}

type DocsPageProps = {
  /** The manifest href of this route. */
  href: string;
  children: ReactNode;
};

/** The shared shell of an authored page: H1, lede, prose. */
export function DocsPage({ href, children }: DocsPageProps): ReactElement {
  const page = requireStaticPage(href);
  return (
    <>
      <DocsPageTitle>{page.label}</DocsPageTitle>
      <DocsLede>{page.description}</DocsLede>
      <DocsProse>{children}</DocsProse>
    </>
  );
}
