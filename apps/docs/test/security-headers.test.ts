import { describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

/** The headers every response carries, as literal values. */
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
} as const;

describe("response headers", () => {
  it.each(["/", "/docs", "/studio", "/api/themes", "/components/does-not-exist"])(
    "%s carries the security headers and does not name the framework",
    async (pathname) => {
      const response = await fetch(new URL(pathname, docsBaseUrl()));
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers.get(name), name).toBe(value);
      }
      expect(response.headers.get("x-powered-by")).toBeNull();
    }
  );
});
