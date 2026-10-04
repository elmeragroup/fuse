import { notFound } from "next/navigation";

import { themeSlug } from "@elmeragroup/fuse/theme";

import { COMPONENT_PAGES } from "../../../../generated/component-pages";
import { requireComponent } from "../../../../lib/component-page";
import { DOCUMENT_THEME } from "../../../../lib/theme";
import { ComponentImage } from "../../../../og/component-image";
import { loadBrandArtwork } from "../../../../og/og-assets";
import { ogResponse } from "../../../../og/og-response";
import { css, requireOgTheme } from "../../../../og/og-theme";
import { specimenContext } from "../../../../og/specimen-kit";
import { isComponentSlug, SPECIMENS } from "../../../../og/specimens";

/** The component pages are a closed set; any other slug answers 404. */
export const dynamicParams = false;

/**
 * Images render per request rather than at build. `generateStaticParams` still names the closed
 * set, so a param outside it answers 404.
 */
export const dynamic = "force-dynamic";

/** One image per component page in the generated manifest. */
export function generateStaticParams(): { slug: string }[] {
  return COMPONENT_PAGES.map((component) => ({ slug: component.slug }));
}

/** A component page's Open Graph image, drawn in the docs theme. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/components/[slug]">
): Promise<Response> {
  const { slug } = await params;
  if (!isComponentSlug(slug)) {
    notFound();
  }
  const theme = requireOgTheme(themeSlug(DOCUMENT_THEME));
  const specimen = SPECIMENS[slug];
  const mark = await loadBrandArtwork("elma", "marks", css(theme.colors.foreground));
  return await ogResponse(
    <ComponentImage
      theme={theme}
      mark={mark}
      component={requireComponent(slug)}
      specimen={specimen.draw(specimenContext(theme, specimen.scale))}
      caption={specimen.caption}
    />
  );
}
