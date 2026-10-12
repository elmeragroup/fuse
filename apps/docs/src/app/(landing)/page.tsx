/**
 * The landing in `OPENING_THEME`, prerendered whole. The landing layout renders the page itself,
 * so a client navigation to a shared address keeps it mounted. A shared address
 * (`/?theme=internal-fkas-company`) never reaches this route: `proxy.ts` rewrites it to
 * `themed/[theme]`, which prerenders the landing once per legal theme. A missing, repeated or
 * illegal `theme` stays here, and the landing layout's head script leaves it in the opening theme.
 */
export default function LandingRoute(): null {
  return null;
}
