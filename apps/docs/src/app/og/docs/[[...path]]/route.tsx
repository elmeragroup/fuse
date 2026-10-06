import { notFound } from "next/navigation";

import { docsHrefFromSegments, docsSegmentsFromHref } from "../../../../lib/og-metadata";
import { HOME_PAGE, STATIC_PAGES } from "../../../../lib/pages";
import { loadElmeraMark } from "../../../../og/og-assets";
import { OgCard } from "../../../../og/og-card";
import { ogResponse } from "../../../../og/og-response";

/**
 * The authored docs pages are a closed set; any other path answers 404. `next build` prerenders
 * every image in it, so a card that throws fails the build rather than the first share.
 */
export const dynamicParams = false;

/**
 * The handler's route context, written here rather than through Next's generated `RouteContext`,
 * which exists only after `next typegen` and so is an error type where lint runs on a fresh
 * checkout. The optional catch-all is absent for the bare `/og/docs`.
 */
type DocsImageContext = {
  /** The catch-all segments, as Next passes them to a route handler. */
  readonly params: Promise<{ path?: string[] }>;
};

/** The docs index's subtitle, its metadata title in `src/app/(docs)/docs/page.tsx`. */
const DOCS_INDEX_SUBTITLE = "Overview";

/**
 * The subtitle of the docs page at `href`: its SideNav label, or the docs index's title.
 *
 * @param href - A docs page href.
 * @returns The subtitle, or `undefined` when no authored page has that route.
 */
function docsSubtitle(href: string): string | undefined {
  if (href === HOME_PAGE.href) {
    return DOCS_INDEX_SUBTITLE;
  }
  return STATIC_PAGES.find((page) => page.href === href)?.label;
}

/** One image per authored docs page; the docs index draws at the bare `/og/docs`. */
export function generateStaticParams(): { path: string[] }[] {
  return [HOME_PAGE, ...STATIC_PAGES].map((page) => ({ path: docsSegmentsFromHref(page.href) }));
}

/** An authored docs page's Open Graph image: the card with the page's label. */
export async function GET(_request: Request, { params }: DocsImageContext): Promise<Response> {
  const { path = [] } = await params;
  const subtitle = docsSubtitle(docsHrefFromSegments(path));
  if (subtitle === undefined) {
    notFound();
  }
  return await ogResponse(<OgCard mark={await loadElmeraMark()} subtitle={subtitle} />);
}
