import { notFound } from "next/navigation";

import { COMPONENT_PAGES } from "../../../../generated/component-pages";
import { componentBySlug } from "../../../../lib/nav";
import { loadElmeraMark } from "../../../../og/og-assets";
import { OgCard } from "../../../../og/og-card";
import { ogResponse } from "../../../../og/og-response";

/**
 * The handler's route context, written here rather than through Next's generated `RouteContext`,
 * which exists only after `next typegen` and so is an error type where lint runs on a fresh
 * checkout.
 */
type ComponentImageContext = {
  /** The dynamic segment, as Next passes it to a route handler. */
  readonly params: Promise<{ slug: string }>;
};

/**
 * One image per component page in the generated manifest. `next build` prerenders every image in
 * it, so a card that throws fails the build rather than the first share.
 */
export function generateStaticParams(): { slug: string }[] {
  return COMPONENT_PAGES.map((component) => ({ slug: component.slug }));
}

/**
 * A component page's Open Graph image: the card with the component's title. The component pages
 * are a closed set, so a slug outside it answers 404 instead of rendering on request.
 */
export async function GET(_request: Request, { params }: ComponentImageContext): Promise<Response> {
  const { slug } = await params;
  const component = componentBySlug(slug);
  if (component === undefined) {
    notFound();
  }
  return ogResponse(<OgCard mark={loadElmeraMark()} subtitle={component.title} />);
}
