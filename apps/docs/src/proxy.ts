import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { themeSlug } from "@elmeragroup/fuse/theme";

import { parseThemeQuery, sameTheme, THEME_QUERY } from "./app/(landing)/landing/landing-theme-defaults";
import { OPENING_THEME } from "./lib/theme";

/**
 * Serves a shared landing address, `/?theme=internal-fkas-company`, from the landing prerendered in
 * that theme, while the address bar keeps the query. It reads every `theme` value the way the
 * landing does, so only a single legal slug reaches the themed route. A missing, repeated or illegal
 * value falls through to the static `/` in the opening theme. A `next.config.ts` rewrite cannot make
 * that call: its `has` condition tests only the last value of a repeated key.
 *
 * Next names a loopback IP host `localhost` in this request's URL but not in its own routing, so
 * on a server started with `--hostname 127.0.0.1` the rewrite reads as an external address, and
 * the themed route's redirect answers it. Start such a server on `localhost` instead.
 */
export function proxy(request: NextRequest): NextResponse {
  const values = request.nextUrl.searchParams.getAll(THEME_QUERY);
  // In the shape Next gives a page's `searchParams`: one value as a string, a repeated key as a list.
  const theme = parseThemeQuery(values.length > 1 ? values : values[0]);
  // The opening theme's own slug renders what `/` renders, so it stays there with the rest.
  if (sameTheme(theme, OPENING_THEME)) {
    return NextResponse.next();
  }
  const themed = request.nextUrl.clone();
  themed.pathname = `/themed/${themeSlug(theme)}`;
  return NextResponse.rewrite(themed);
}

/**
 * Only the landing with a `theme` query: every other request skips the proxy. Next reads the
 * matcher at build time, so it names the query key literally rather than through `THEME_QUERY`.
 */
export const config = {
  matcher: [{ source: "/", has: [{ type: "query", key: "theme" }] }],
};
