import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";

import { docsRoot } from "../scripts/lib/paths.ts";
import { generateStaticParams as componentImageParams } from "../src/app/og/components/[slug]/route";
import { generateStaticParams as docsImageParams } from "../src/app/og/docs/[[...path]]/route";
import { GET as landingImage } from "../src/app/og/landing/route";
import { THEME_CATALOG } from "../src/generated/theme-catalog";
import { parseSiteOrigin } from "../src/lib/site-origin";
import { COMPONENT_INVENTORY } from "./component-inventory";
import { decodePng } from "./png";

const docsAppDir = path.join(docsRoot, "src/app/(docs)");

/** Every authored docs route on disk: a `page.tsx` outside the component pages. */
function authoredDocsRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      if (prefix === "" && entry === "components") {
        continue;
      }
      routes.push(...authoredDocsRoutes(absolute, `${prefix}/${entry}`));
    } else if (entry === "page.tsx") {
      routes.push(prefix);
    }
  }
  return routes;
}

describe("OG image routes", () => {
  it("serve one component image per reviewed component page", () => {
    const params = componentImageParams().map((param) => param.slug);
    expect(params.toSorted()).toEqual([...COMPONENT_INVENTORY.keys()].toSorted());
  });

  it("serve one docs image per authored docs route, the docs index at the bare prefix", () => {
    const routes = docsImageParams().map((param) =>
      param.path.length === 0 ? "/docs" : `/${param.path.join("/")}`
    );
    expect(routes.toSorted()).toEqual(authoredDocsRoutes(docsAppDir).toSorted());
  });
});

/** A catalog primary as 0–255 sRGB channels, converted by the color package alone. */
function catalogPrimary(slug: string): number[] {
  const value = THEME_CATALOG.themes.find((theme) => theme.slug === slug)?.tokens["--primary"] ?? "";
  const parsed = CssColor.parse(value);
  if (parsed._tag === "err") {
    throw parsed.error;
  }
  const srgb = CssColor.toSrgb(parsed.value);
  return [srgb.r, srgb.g, srgb.b].map((channel) => Math.round(channel * 255));
}

/** The first pixel of the signature band, where the landing's gradient starts at `--primary`. */
async function bandStart(query: string): Promise<number[]> {
  const response = await landingImage(new Request(`http://docs.test/og/landing${query}`));
  expect(response.headers.get("content-type")).toBe("image/png");
  const png = decodePng(new Uint8Array(await response.arrayBuffer()));
  expect([png.width, png.height]).toEqual([1200, 630]);
  return png.pixel(0, 626).slice(0, 3);
}

function expectClose(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((channel, index) => {
    expect(Math.abs(channel - (expected[index] ?? -1)), `channel ${String(index)}`).toBeLessThanOrEqual(2);
  });
}

describe("landing OG image", () => {
  it("paints the theme ?theme= names", async () => {
    expectClose(await bandStart("?theme=external-fkas-private"), catalogPrimary("external-fkas-private"));
  });

  it("paints the landing's opening theme for a missing, repeated or illegal theme", async () => {
    const fallback = catalogPrimary("external-elma-private");
    expect(fallback).not.toEqual(catalogPrimary("external-fkas-private"));
    for (const query of [
      "",
      "?theme=external-fkab-private",
      "?theme=external-fkas-private&theme=external-tkas-private",
    ]) {
      expectClose(await bandStart(query), fallback);
    }
  });
});

describe("site origin", () => {
  it("falls back to localhost on the server's port when DOCS_ORIGIN is unset", () => {
    expect(parseSiteOrigin({})).toEqual({ _tag: "ok", value: new URL("http://localhost:3000") });
    expect(parseSiteOrigin({ DOCS_ORIGIN: "", PORT: "4123" })).toEqual({
      _tag: "ok",
      value: new URL("http://localhost:4123"),
    });
  });

  it("accepts a bare http(s) origin", () => {
    const result = parseSiteOrigin({
      DOCS_ORIGIN: "https://fuse-docs---pr-12.example.azurecontainerapps.io",
    });
    expect(result._tag === "ok" ? result.value.href : result.error.message).toBe(
      "https://fuse-docs---pr-12.example.azurecontainerapps.io/"
    );
  });

  it("refuses a value that is not a bare http(s) origin", () => {
    for (const [input, reason] of [
      ["fuse.example.com", "unparsable"],
      ["ftp://fuse.example.com", "protocol"],
      ["https://fuse.example.com/docs", "not-an-origin"],
      ["https://fuse.example.com?x=1", "not-an-origin"],
    ] as const) {
      const result = parseSiteOrigin({ DOCS_ORIGIN: input });
      expect(result._tag === "err" ? result.error.reason : "ok", input).toBe(reason);
    }
  });
});
