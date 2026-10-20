import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

describe("unmatched addresses", () => {
  it("answer with the site's own 404 page, which links back into the docs", async () => {
    const response = await fetch(new URL("/components/does-not-exist", docsBaseUrl()));
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("<title>Page not found · Fuse</title>");
    expect(html).toMatch(/<h1[^>]*>Page not found<\/h1>/u);
    expect(html).toMatch(/<a[^>]*href="\/docs"[^>]*>Read the docs<\/a>/u);
  });
});
