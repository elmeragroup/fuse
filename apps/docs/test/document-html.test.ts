import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";
import {
  BOOTSTRAP_MANIFEST_KEY,
  DOCUMENT_BRAND,
  INJECTED_BOOTSTRAP_SOURCE_KEY,
  bootstrapScripts,
  firstPaintableIndex,
  openTag,
  readDocumentBrand,
  readDocumentDensity,
  tagAttribute,
} from "./html";

async function fetchHtml(pathname: string): Promise<string> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  expect(response.ok).toBe(true);
  return await response.text();
}

/** Reads the one host color bootstrap and checks that nothing paintable precedes it. */
function expectBootstrapFirst(html: string): number {
  const bootstraps = bootstrapScripts(html);
  expect(bootstraps).toHaveLength(1);
  const bootstrap = bootstraps[0];
  expect(bootstrap).toBeDefined();
  expect(html).not.toContain(INJECTED_BOOTSTRAP_SOURCE_KEY);

  const paintable = firstPaintableIndex(html);
  expect(paintable).toBeGreaterThan(-1);
  expect(bootstrap?.start).toBeGreaterThan(-1);
  expect(bootstrap?.start).toBeLessThan(paintable);
  return bootstrap?.start ?? -1;
}

describe("docs response HTML", () => {
  it("places the host color bootstrap before every paintable landing child at the site root", async () => {
    const html = await fetchHtml("/");
    expectBootstrapFirst(html);
    // The landing deploys external, whose library default density is comfortable.
    expect(readDocumentDensity(html)).toBe("comfortable");
    expect(html).toContain("data-landing");
  });

  it("places the host color bootstrap before every paintable docs child", async () => {
    const html = await fetchHtml("/docs");
    const bootstrapStart = expectBootstrapFirst(html);

    const skipNav = html.indexOf("Skip to contents");
    const docsRoot = html.indexOf("data-docs-root");
    expect(skipNav).toBeGreaterThan(bootstrapStart);
    expect(docsRoot).toBeGreaterThan(bootstrapStart);
    expect(html.indexOf(BOOTSTRAP_MANIFEST_KEY)).toBeGreaterThan(-1);
  });

  it("serves the studio as a light document, so a light artboard can sit in it", async () => {
    // Dark rules are descendant selectors, so a dark `<html>` would darken every artboard. The
    // studio stamps no scheme on the document and runs no scheme bootstrap; its chrome and its
    // artboards set `data-theme` on their own subtrees.
    const html = await fetchHtml("/studio");
    const root = openTag(html, "html");
    expect(root).not.toBeNull();
    expect(tagAttribute(root ?? "", "data-theme")).toBeNull();
    expect(bootstrapScripts(html)).toHaveLength(0);
    expect(html).not.toContain(BOOTSTRAP_MANIFEST_KEY);
    expect(html).toContain('aria-label="Canvas"');
  });

  it("keeps reserved roots branded without provider, picker, or color bootstrap", async () => {
    for (const pathname of ["/private", "/website"] as const) {
      const html = await fetchHtml(pathname);
      expect(readDocumentBrand(html)).toEqual(DOCUMENT_BRAND);
      expect(readDocumentDensity(html)).toBe("dense");
      expect(bootstrapScripts(html)).toHaveLength(0);
      expect(html).not.toContain(BOOTSTRAP_MANIFEST_KEY);
      expect(html).not.toContain('aria-label="Variant"');
      expect(html).not.toContain('aria-label="Brand"');
      expect(html).not.toContain('aria-label="Segment"');
      expect(html).not.toContain("ThemePicker");
      expect(html).not.toContain("data-docs-root");
      expect(html).not.toContain("Skip to contents");
    }
  });
});
