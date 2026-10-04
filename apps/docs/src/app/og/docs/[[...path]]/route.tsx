import { notFound } from "next/navigation";

import { themeSlug } from "@elmeragroup/fuse/theme";

import { docsHrefFromSegments } from "../../../../lib/og-metadata";
import { DOCUMENT_THEME } from "../../../../lib/theme";
import { docsArt } from "../../../../og/docs-art";
import { DocsImage } from "../../../../og/docs-image";
import { OG_DOCS_PAGES, ogDocsPage } from "../../../../og/docs-pages";
import { loadBrandArtwork } from "../../../../og/og-assets";
import { ogResponse } from "../../../../og/og-response";
import { css, requireOgTheme } from "../../../../og/og-theme";

/** The authored docs pages are a closed set; any other path answers 404. */
export const dynamicParams = false;

/**
 * Images render per request rather than at build. `generateStaticParams` still names the closed
 * set, so a param outside it answers 404.
 */
export const dynamic = "force-dynamic";

/** One image per authored docs page; the docs index draws at the bare `/og/docs`. */
export function generateStaticParams(): { path: string[] }[] {
  return OG_DOCS_PAGES.map((page) => ({ path: page.href === "/docs" ? [] : page.href.slice(1).split("/") }));
}

/** An authored docs page's Open Graph image, drawn in the docs theme. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/docs/[[...path]]">
): Promise<Response> {
  const { path = [] } = await params;
  const page = ogDocsPage(docsHrefFromSegments(path));
  if (page === undefined) {
    notFound();
  }
  const theme = requireOgTheme(themeSlug(DOCUMENT_THEME));
  const mark = await loadBrandArtwork("elma", "marks", css(theme.colors.foreground));
  const draw = docsArt(page.href);
  const art = draw === undefined ? undefined : await draw(theme);
  return await ogResponse(
    art === undefined ? (
      <DocsImage theme={theme} mark={mark} kind={page.kind} title={page.title} lede={page.lede} />
    ) : (
      <DocsImage theme={theme} mark={mark} kind={page.kind} title={page.title} lede={page.lede} art={art} />
    )
  );
}
