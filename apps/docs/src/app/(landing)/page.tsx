import type { ReactElement } from "react";

import type { Metadata } from "next";

import { BRANDS } from "@elmeragroup/fuse/theme";

import { ogLandingPath, ogMetadata } from "../../lib/og-metadata";
import { LandingPage } from "./landing/landing-page";
import { parseThemeQuery, THEME_QUERY } from "./landing/landing-theme-defaults";

/** Props Next passes the landing route; `searchParams` carries the shared `?theme=` address. */
export type LandingRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The card follows the shared theme: the image route receives the parsed, canonical slug, never
 * the raw parameter, so an illegal or repeated value previews the same fallback theme the page
 * opens in.
 */
export async function generateMetadata({ searchParams }: LandingRouteProps): Promise<Metadata> {
  const query = await searchParams;
  const theme = parseThemeQuery(query[THEME_QUERY]);
  return ogMetadata({
    image: ogLandingPath(theme),
    alt: `Fuse, the Elmera Group design system, in the ${BRANDS[theme.brand].displayName} theme: One system. Every brand.`,
  });
}

/**
 * The landing renders per request, because a shared address names the theme it opens in
 * (`?theme=internal-fkas-company`). The server renders the nav, the hero window's side and the
 * brand picker in that theme, so hydration finds what it would render itself.
 */
export default async function LandingRoute({ searchParams }: LandingRouteProps): Promise<ReactElement> {
  const query = await searchParams;
  return <LandingPage theme={parseThemeQuery(query[THEME_QUERY])} />;
}
