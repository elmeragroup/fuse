import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import { staticPageFor } from "../lib/pages";
import "./DocsPage.css";

/**
 * Page metadata for an authored Overview/Handbook route.
 *
 * Title and description come from the same manifest entry the SideNav and the generated
 * `llms.txt` index read, so the three can never describe a page differently.
 */
export function pageMetadata(href: string): Metadata {
  const page = staticPageFor(href);
  if (page === undefined) {
    throw new Error(`${href} is not in the docs page manifest (src/lib/pages.ts)`);
  }
  return { title: page.label, description: page.description };
}

export type DocsPageProps = {
  /** The manifest href of this route. */
  href: string;
  children: ReactNode;
};

/** The shared shell of an authored page: H1, lede, prose. */
export function DocsPage({ href, children }: DocsPageProps): ReactElement {
  const page = staticPageFor(href);
  if (page === undefined) {
    throw new Error(`${href} is not in the docs page manifest (src/lib/pages.ts)`);
  }
  return (
    <>
      <h1>{page.label}</h1>
      <p className="DocsLede">{page.description}</p>
      <div className="DocsProse">{children}</div>
    </>
  );
}
