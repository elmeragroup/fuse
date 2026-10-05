/**
 * The public origin the docs site serves, which every absolute URL in page metadata resolves
 * against. Open Graph and X cards need absolute image URLs, and the layouts' `metadataBase`
 * turns the site-relative `/og/...` paths into them.
 *
 * The origin comes from `DOCS_ORIGIN`. The docs and component pages prerender during
 * `next build`, so the build bakes the value into their HTML: `apps/docs/Dockerfile` takes it as
 * a build argument, and the preview and merge workflows read it from the Container Apps
 * environment first (`.github/scripts/docs-container-app.sh origin-preview|origin-prod`). The
 * landing renders per request and reads the same variable at runtime, which the Dockerfile's
 * runtime stage sets to the build's value, so one input decides the origin of every page.
 *
 * Unset, the origin falls back to `http://localhost:<PORT>` (3000 without `PORT`), so local
 * builds and the test server still emit absolute URLs. A set but malformed value fails the
 * build rather than publishing broken cards.
 */

/** Why `DOCS_ORIGIN` is not a usable origin. */
export class InvalidSiteOrigin extends Error {
  readonly _tag = "InvalidSiteOrigin" as const;

  constructor(
    readonly input: string,
    readonly reason: "unparsable" | "protocol" | "not-an-origin"
  ) {
    super(
      `DOCS_ORIGIN must be an http(s) origin such as https://docs.example.com, got "${input}" (${reason})`
    );
  }
}

/** A parsed site origin, or why the input is not one. */
type SiteOriginResult =
  | { readonly _tag: "ok"; readonly value: URL }
  | { readonly _tag: "err"; readonly error: InvalidSiteOrigin };

/** The environment variables the origin reads. */
type SiteOriginEnv = {
  readonly DOCS_ORIGIN?: string | undefined;
  readonly PORT?: string | undefined;
};

const DEFAULT_PORT = "3000";

/**
 * Parse the site origin from the environment.
 *
 * @param env - The variables to read, normally `process.env`.
 * @returns The origin as a `URL` with path `/`, or `InvalidSiteOrigin` when `DOCS_ORIGIN` is set
 *   but is not a bare http(s) origin.
 */
export function parseSiteOrigin(env: SiteOriginEnv): SiteOriginResult {
  const input = env.DOCS_ORIGIN;
  if (input === undefined || input === "") {
    const port = env.PORT !== undefined && /^\d+$/u.test(env.PORT) ? env.PORT : DEFAULT_PORT;
    return { _tag: "ok", value: new URL(`http://localhost:${port}`) };
  }
  if (!URL.canParse(input)) {
    return { _tag: "err", error: new InvalidSiteOrigin(input, "unparsable") };
  }
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { _tag: "err", error: new InvalidSiteOrigin(input, "protocol") };
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "" || url.username !== "") {
    return { _tag: "err", error: new InvalidSiteOrigin(input, "not-an-origin") };
  }
  return { _tag: "ok", value: url };
}

/**
 * The site origin from `process.env`, for a layout's `metadataBase`.
 *
 * @returns The parsed origin.
 * @throws {InvalidSiteOrigin} When `DOCS_ORIGIN` is malformed. Layout metadata is the
 *   composition root here, and a throw is how it fails `next build` with the message.
 */
export function siteOrigin(): URL {
  const result = parseSiteOrigin({ DOCS_ORIGIN: process.env.DOCS_ORIGIN, PORT: process.env.PORT });
  if (result._tag === "err") {
    throw result.error;
  }
  return result.value;
}
