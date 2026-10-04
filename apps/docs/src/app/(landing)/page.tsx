import type { ReactElement } from "react";

import { LandingPage } from "./landing/landing-page";
import { parseThemeQuery, THEME_QUERY } from "./landing/landing-theme-defaults";

/** Props Next passes the landing route; `searchParams` carries the shared `?theme=` address. */
export type LandingRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The landing renders per request, because a shared address names the theme it opens in
 * (`?theme=internal-fkas-company`). The server renders the nav, the hero window's side and the
 * brand picker in that theme, so hydration finds what it would render itself.
 */
export default async function LandingRoute({ searchParams }: LandingRouteProps): Promise<ReactElement> {
  const query = await searchParams;
  return <LandingPage theme={parseThemeQuery(query[THEME_QUERY])} />;
}
