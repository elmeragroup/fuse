import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";
import {
  BOOTSTRAP_MANIFEST_KEY,
  DOCUMENT_BRAND,
  INJECTED_BOOTSTRAP_SOURCE_KEY,
  bootstrapScripts,
  firstPaintableIndex,
  readDocumentBrand,
} from "./html";

async function fetchHtml(pathname: string): Promise<string> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  expect(response.ok).toBe(true);
  return await response.text();
}

describe("docs response HTML", () => {
  it.each(["/", "/private", "/website"] as const)(
    "stamps the Elmera document brand on %s",
    async (pathname) => {
      const html = await fetchHtml(pathname);
      expect(readDocumentBrand(html)).toEqual(DOCUMENT_BRAND);
    }
  );

  it("places the host color bootstrap before every paintable docs child", async () => {
    const html = await fetchHtml("/");
    const bootstraps = bootstrapScripts(html);
    expect(bootstraps).toHaveLength(1);
    const bootstrap = bootstraps[0];
    expect(bootstrap).toBeDefined();
    expect(html).not.toContain(INJECTED_BOOTSTRAP_SOURCE_KEY);

    const paintable = firstPaintableIndex(html);
    expect(paintable).toBeGreaterThan(-1);
    expect(bootstrap?.start).toBeGreaterThan(-1);
    expect(bootstrap?.start).toBeLessThan(paintable);

    const skipNav = html.indexOf("Skip to contents");
    const docsRoot = html.indexOf("DocsRoot");
    expect(skipNav).toBeGreaterThan(bootstrap?.start ?? -1);
    expect(docsRoot).toBeGreaterThan(bootstrap?.start ?? -1);
    expect(html.indexOf(BOOTSTRAP_MANIFEST_KEY)).toBeGreaterThan(-1);
  });

  it("keeps reserved roots branded without provider, picker, or color bootstrap", async () => {
    for (const pathname of ["/private", "/website"] as const) {
      const html = await fetchHtml(pathname);
      expect(readDocumentBrand(html)).toEqual(DOCUMENT_BRAND);
      expect(bootstrapScripts(html)).toHaveLength(0);
      expect(html).not.toContain(BOOTSTRAP_MANIFEST_KEY);
      expect(html).not.toContain('aria-label="Variant"');
      expect(html).not.toContain('aria-label="Brand"');
      expect(html).not.toContain('aria-label="Segment"');
      expect(html).not.toContain("ThemePicker");
      expect(html).not.toContain("DocsRoot");
      expect(html).not.toContain("Skip to contents");
    }
  });
});
