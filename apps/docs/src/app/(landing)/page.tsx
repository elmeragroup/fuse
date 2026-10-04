import type { ReactElement } from "react";

import { LandingPage } from "./landing/landing-page";
import { parseThemeQuery, THEME_QUERY } from "./landing/landing-theme-defaults";

/**
 * The landing renders per request, because a shared address names the theme it opens in
 * (`?theme=internal-fkas-company`). The server renders the nav, the hero window's side and the
 * brand picker in that theme, so hydration finds what it would render itself.
 */
export default async function LandingRoute({ searchParams }: PageProps<"/">): Promise<ReactElement> {
  const query = await searchParams;
  return <LandingPage theme={parseThemeQuery(query[THEME_QUERY])} />;
}
