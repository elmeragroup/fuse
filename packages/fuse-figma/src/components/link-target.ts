/**
 * The target a Figma range link can hold for an `<a href>` inside a label. On 2026-11-21 a real
 * file's `setRangeHyperlink` stored `https://example.com/pay?id=4821` as written and refused
 * `#invoice-4821` and `/invoices/1042` with `Unsupported or invalid hyperlink url` (live probe RH1,
 * RH2). A fragment or a path names a place relative to the host page, which a Figma file has no
 * equivalent of, so such a link draws no target.
 */

/** An `href` written out as `http://` or `https://`, a host, and no white space. */
const WRITTEN_OUT = /^https?:\/\/[^/?#\s][^\s]*$/iu;

/**
 * The URL a Figma range link holds for an `href`.
 *
 * @param href - The `href` attribute as the capture recorded it, or undefined for an element without one.
 * @returns The `href` as written where it reads `http://` or `https://` and a host and parses as a
 *   URL, or undefined for a fragment, a path, another scheme or no `href`.
 */
export function linkTarget(href: string | undefined): string | undefined {
  // The URL parser also reads `https:example.com` and a padded `href`, which Figma may store
  // otherwise than as written, so the link takes only an `href` written out as `scheme://host`.
  return href !== undefined && WRITTEN_OUT.test(href) && URL.canParse(href) ? href : undefined;
}
