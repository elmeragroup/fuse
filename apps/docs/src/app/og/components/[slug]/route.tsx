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

/**
 * The handler's route context, written here rather than through Next's generated `RouteContext`,
 * which exists only after `next typegen` and so is an error type where lint runs on a fresh
 * checkout.
 */
type ComponentImageContext = {
  /** The dynamic segment, as Next passes it to a route handler. */
  readonly params: Promise<{ slug: string }>;
};

/** One image per component page in the generated manifest. */
export function generateStaticParams(): { slug: string }[] {
  return COMPONENT_PAGES.map((component) => ({ slug: component.slug }));
}

/** A component page's Open Graph image, drawn in the docs theme. */
export async function GET(_request: Request, { params }: ComponentImageContext): Promise<Response> {
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
