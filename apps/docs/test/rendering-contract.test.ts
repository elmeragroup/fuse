import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsBaseUrl, docsBuildDir } from "./docs-server";
import { readDocumentBrand } from "./html";

/*
 * The production server marks what it serves from build output. A page served whole from its
 * prerender carries `x-nextjs-prerender: 1`; a page whose prerender stopped at a Suspense hole
 * also carries `x-nextjs-postponed: 1`, because its prerendered shell is resumed per request. A
 * route handler answered from its build output carries `x-nextjs-cache: HIT`, from the first
 * request on; one generated at request time answers `MISS` first, and a dynamic one carries no
 * `x-nextjs-cache` at all.
 *
 * A header proves the server answered from its cache, not that the build filled it: Next also
 * writes a request-generated handler response to disk, so a later run on the same build answers
 * it `HIT`. So each path is also cross-checked against the oracle that must agree with the
 * hand-written lists, the build's own record of what it prerendered: `prerender-manifest.json` in
 * the directory the suite's server serves.
 */

/** The fields of a prerender manifest route these tests read. */
type PrerenderedRoute = {
  routeType: string;
  renderingMode: string;
  response: string;
  initialRevalidateSeconds: number | false;
};

/** The build's record of each path it prerendered, keyed by path. */
const prerendered: Partial<Record<string, PrerenderedRoute>> =
  // SAFETY: `next build` writes this manifest, and every test compares each field it reads
  // against an expected value, so a shape that disagrees with the type fails the test.
  (
    JSON.parse(readFileSync(path.join(docsBuildDir, "prerender-manifest.json"), "utf8")) as {
      routes: Partial<Record<string, PrerenderedRoute>>;
    }
  ).routes;

/**
 * The build's record of a page it prerendered whole and never revalidates. With Cache Components
 * every page is `PARTIALLY_STATIC`; `response: "complete"` rules out both pending UI and postponed
 * server work, while `initial` can mean either.
 */
const WHOLE_PAGE = {
  routeType: "page",
  renderingMode: "PARTIALLY_STATIC",
  response: "complete",
  initialRevalidateSeconds: false,
} as const;

/** The build's record of a handler it answered at build time and never revalidates. */
const STATIC_HANDLER = {
  routeType: "route",
  renderingMode: "STATIC",
  response: "complete",
  initialRevalidateSeconds: false,
} as const;

/** One page from each group whose layout requires its routes to prerender whole. */
const STATIC_PAGES = [
  "/components/button",
  "/handbook/theming",
  "/studio",
  "/studio/color",
  "/website",
  "/private",
] as const;

/** Route handlers that read nothing from the request, so the build answers them. */
const STATIC_HANDLERS = ["/api/themes", "/api/themes/figma", "/og/landing", "/og/components/button"] as const;

/**
 * An address outside a handler's closed set of parameters. The OG images' unknown paths are
 * covered in `og-images.browser.test.ts`.
 */
const UNKNOWN_HANDLER_PATH = "/api/themes/figma/not-a-theme";

/** The landing's opening theme, as its theme trigger names it and its layout stamps it. */
const OPENING = {
  label: "Theme: Elmera · Private · External",
  brand: { variant: "external", brand: "elma", segment: "private" },
} as const;

/** A shared address's theme, by its slug and as the trigger names it. */
const SHARED = {
  slug: "internal-fkas-company",
  label: "Theme: Fjordkraft · Company · Internal",
} as const;

/**
 * Addresses `parseThemeQuery` opens on the opening theme: a slug Fuse does not know, and a
 * repeated `theme`, even when its last value is legal.
 */
const OPENING_ADDRESSES = [
  "/?theme=not-a-theme",
  `/?theme=${SHARED.slug}&theme=external-elma-private`,
  `/?theme=external-elma-private&theme=${SHARED.slug}`,
] as const;

/** The hero heading's id, which one copy of the landing renders once. */
const LANDING_TITLE = 'id="landing-title"';

/** The internal route a shared address is served from, which no visitor should land on. */
const INTERNAL_ROUTE = `/themed/${SHARED.slug}`;

function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

async function get(pathname: string): Promise<{ response: Response; text: string }> {
  const response = await fetch(new URL(pathname, docsBaseUrl()), { redirect: "manual" });
  return { response, text: await response.text() };
}

describe("rendering contract", () => {
  it.each(STATIC_PAGES)("serves %s whole from its prerender", async (pathname) => {
    const { response } = await get(pathname);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-nextjs-prerender")).toContain("1");
    expect(response.headers.get("x-nextjs-postponed")).toBeNull();
    expect(prerendered[pathname]).toMatchObject(WHOLE_PAGE);
  });

  it.each(STATIC_HANDLERS)("answers %s from the build", async (pathname) => {
    const { response } = await get(pathname);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-nextjs-cache")).toBe("HIT");
    expect(prerendered[pathname]).toMatchObject(STATIC_HANDLER);
  });

  it(`answers ${UNKNOWN_HANDLER_PATH} with 404`, async () => {
    const { response } = await get(UNKNOWN_HANDLER_PATH);
    expect(response.status).toBe(404);
  });

  it("serves the landing in the opening theme whole from its prerender", async () => {
    const { response, text } = await get("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-nextjs-prerender")).toContain("1");
    expect(response.headers.get("x-nextjs-postponed")).toBeNull();
    expect(readDocumentBrand(text)).toEqual(OPENING.brand);
    expect(text).toContain(`aria-label="${OPENING.label}"`);
    expect(text).toContain("One system");
    expect(text).toContain("Fuse is built by Elmera Group");
    expect(text).not.toContain(`aria-label="${SHARED.label}"`);
    expect(occurrences(text, LANDING_TITLE)).toBe(1);
    expect(prerendered["/"]).toMatchObject(WHOLE_PAGE);
  });

  it("serves one copy of a shared address's landing whole from its prerender", async () => {
    const { response, text } = await get(`/?theme=${SHARED.slug}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-nextjs-prerender")).toContain("1");
    expect(response.headers.get("x-nextjs-postponed")).toBeNull();
    expect(text).toContain(`aria-label="${SHARED.label}"`);
    expect(occurrences(text, LANDING_TITLE)).toBe(1);
    expect(prerendered[INTERNAL_ROUTE]).toMatchObject(WHOLE_PAGE);
  });

  it.each(OPENING_ADDRESSES)("serves %s in the opening theme", async (address) => {
    const { response, text } = await get(address);
    expect(response.status).toBe(200);
    expect(readDocumentBrand(text)).toEqual(OPENING.brand);
    expect(text).toContain(`aria-label="${OPENING.label}"`);
    expect(text).not.toContain(`aria-label="${SHARED.label}"`);
    expect(occurrences(text, LANDING_TITLE)).toBe(1);
  });

  it("sends a request for the internal route to the shared address", async () => {
    const { response } = await get(INTERNAL_ROUTE);
    expect([307, 308]).toContain(response.status);
    expect(new URL(response.headers.get("location") ?? "", docsBaseUrl()).href).toBe(
      new URL(`/?theme=${SHARED.slug}`, docsBaseUrl()).href
    );
  });
});
