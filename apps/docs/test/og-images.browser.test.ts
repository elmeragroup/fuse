import { describe, expect, it } from "vitest";

import { docsBaseUrl, fetchText, TEST_RUNTIME_ORIGIN } from "./docs-server";
import { pngSize } from "./png";

/**
 * The origin prerendered pages carry. They bake in the build's origin, and the builds this suite
 * runs against (turbo's `docs#build` in CI, `next build` locally) leave `DOCS_ORIGIN` unset, so
 * the documented fallback applies. Only the Docker image build sets it. A run against a build made
 * with `DOCS_ORIGIN` or `PORT` set fails here, by design.
 */
const BUILD_FALLBACK_ORIGIN = "http://localhost:3000";

/** The `content` of the one `<meta>` tag whose `property` or `name` is `key`. */
function metaContent(html: string, key: string): string {
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => tag.includes(`property="${key}"`) || tag.includes(`name="${key}"`));
  expect(tags, key).toHaveLength(1);
  const content = /content="([^"]*)"/.exec(tags[0] ?? "")?.[1] ?? "";
  return content.replaceAll("&amp;", "&");
}

/**
 * Reads a page's card image URL, checks the X card agrees with it, and returns it whole. The
 * caller fetches the image by its path from the server under test, since neither expected origin
 * resolves to that server.
 */
async function cardImage(pathname: string): Promise<string> {
  const html = await fetchText(pathname);
  const og = metaContent(html, "og:image");
  expect(metaContent(html, "twitter:image")).toBe(og);
  expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
  expect(metaContent(html, "og:image:alt")).not.toBe("");
  return og;
}

describe("Open Graph cards", () => {
  for (const [pathname, origin, imagePath] of [
    ["/", TEST_RUNTIME_ORIGIN, "/og/landing?theme=external-elma-private"],
    ["/?theme=external-fkas-private", TEST_RUNTIME_ORIGIN, "/og/landing?theme=external-fkas-private"],
    ["/handbook/theme-matrix", BUILD_FALLBACK_ORIGIN, "/og/docs/handbook/theme-matrix"],
    ["/components/button", BUILD_FALLBACK_ORIGIN, "/og/components/button"],
  ] as const) {
    it(`${pathname} names ${origin}${imagePath}, a 1200 × 630 PNG`, async () => {
      expect(await cardImage(pathname)).toBe(`${origin}${imagePath}`);
      const response = await fetch(new URL(imagePath, docsBaseUrl()));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({ width: 1200, height: 630 });
    });
  }

  it("passes only the canonical landing theme on, never the raw parameter", async () => {
    for (const query of [
      "?theme=external-fkab-private",
      "?theme=EXTERNAL-FKAS-PRIVATE",
      "?theme=a&theme=b",
    ]) {
      expect(await cardImage(`/${query}`), query).toBe(
        `${TEST_RUNTIME_ORIGIN}/og/landing?theme=external-elma-private`
      );
    }
  });

  it("answers 404 for an image of a page that does not exist", async () => {
    for (const pathname of ["/og/components/not-a-component", "/og/docs/handbook/not-a-page"]) {
      expect((await fetch(new URL(pathname, docsBaseUrl()))).status, pathname).toBe(404);
    }
  });
});
