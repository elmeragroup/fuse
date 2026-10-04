import { notFound } from "next/navigation";

import { themeSlug } from "@elmeragroup/fuse/theme";

import { docsHrefFromSegments, docsSegmentsFromHref } from "../../../../lib/og-metadata";
import { DOCUMENT_THEME } from "../../../../lib/theme";
import { docsArt } from "../../../../og/docs-art";
import { DocsImage } from "../../../../og/docs-image";
import { OG_DOCS_PAGES, ogDocsPage } from "../../../../og/docs-pages";
import { loadBrandArtwork } from "../../../../og/og-assets";
import { ogResponse } from "../../../../og/og-response";
import { css, ogTheme } from "../../../../og/og-theme";

/**
 * The authored docs pages are a closed set; any other path answers 404. `next build` prerenders
 * every image in it, so art that throws fails the build rather than the first share.
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

/** One image per authored docs page; the docs index draws at the bare `/og/docs`. */
export function generateStaticParams(): { path: string[] }[] {
  return OG_DOCS_PAGES.map((page) => ({ path: docsSegmentsFromHref(page.href) }));
}

/** An authored docs page's Open Graph image, drawn in the docs theme. */
export async function GET(_request: Request, { params }: DocsImageContext): Promise<Response> {
  const { path = [] } = await params;
  const page = ogDocsPage(docsHrefFromSegments(path));
  if (page === undefined) {
    notFound();
  }
  const theme = ogTheme(themeSlug(DOCUMENT_THEME));
  const mark = await loadBrandArtwork("elma", "marks", css(theme.colors.foreground));
  const draw = docsArt(page.href);
  const art = draw === undefined ? undefined : await draw(theme);
  return await ogResponse(
    <DocsImage theme={theme} mark={mark} kind={page.kind} title={page.title} lede={page.lede} art={art} />
  );
}
