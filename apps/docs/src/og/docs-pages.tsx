/**
 * The authored docs pages that get an image, and what each draws: the docs index plus every
 * page in the static manifest. Handbook pages with a strong visual idea draw bespoke art; the
 * rest share the template's chart steps.
 */

import type { ReactElement } from "react";

import { HOME_PAGE, STATIC_PAGES } from "../lib/pages";
import type { StaticHref, StaticNavGroup } from "../lib/pages";
import type { OgKind } from "./og-frame";
import type { OgTheme } from "./og-theme";

/** A page's bespoke art, drawn into the docs image's art box. */
export type DocsArt = (theme: OgTheme) => ReactElement | Promise<ReactElement>;

/** The route of a docs page with an image: the docs index or an authored page. */
export type OgDocsHref = typeof HOME_PAGE.href | StaticHref;

/** One docs page as its image needs it. */
export type OgDocsPage = {
  /** The page's route, as the manifest spells it. */
  readonly href: OgDocsHref;
  readonly kind: OgKind;
  readonly title: string;
  readonly lede: string;
};

const KIND_BY_GROUP = {
  overview: "Guide",
  handbook: "Handbook",
} as const satisfies Record<StaticNavGroup, OgKind>;

/** Every docs page with an image, the docs index first. */
export const OG_DOCS_PAGES: readonly OgDocsPage[] = [
  { href: HOME_PAGE.href, kind: "Guide", title: "Overview", lede: HOME_PAGE.description },
  ...STATIC_PAGES.map((page) => ({
    href: page.href,
    kind: KIND_BY_GROUP[page.group],
    title: page.label,
    lede: page.description,
  })),
];

/**
 * The docs page at `href`.
 *
 * @param href - A page route.
 * @returns The page, or `undefined` when no docs page has that route.
 */
export function ogDocsPage(href: string): OgDocsPage | undefined {
  return OG_DOCS_PAGES.find((page) => page.href === href);
}
