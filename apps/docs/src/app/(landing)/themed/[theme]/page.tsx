import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";

/** Every theme Fuse's slug parser accepts, so each shared address has its own prerender. */
export function generateStaticParams(): { theme: string }[] {
  return LEGAL_THEMES.map((theme) => ({ theme: themeSlug(theme) }));
}

/**
 * The route a shared address opens on. The landing layout renders the page in the theme this
 * route's `theme` param names. Visitors never see this path: `proxy.ts` rewrites `/?theme=<slug>`
 * here for a single legal slug, and `next.config.ts` redirects a request for the path itself back
 * to that address, so no param outside `generateStaticParams` reaches it.
 */
export default function ThemedLandingRoute(): null {
  return null;
}
