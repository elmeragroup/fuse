import { createElement } from "react";

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";

import { docsRoot } from "../scripts/lib/paths.ts";
import { generateStaticParams as componentImageParams } from "../src/app/og/components/[slug]/route";
import { generateStaticParams as docsImageParams } from "../src/app/og/docs/[[...path]]/route";
import { GET as landingImage } from "../src/app/og/landing/route";
import { parseSiteOrigin } from "../src/lib/site-origin";
import { loadElmeraMark } from "../src/og/og-assets";
import { OgCard } from "../src/og/og-card";
import { ogResponse } from "../src/og/og-response";
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

/** The card background Paper draws, `oklch(17.7% 0.003 248)`, as 0–255 sRGB channels. */
function paperBackground(): number[] {
  const parsed = CssColor.parse("oklch(0.177 0.003 248)");
  if (parsed._tag === "err") {
    throw parsed.error;
  }
  const srgb = CssColor.toSrgb(parsed.value);
  return [srgb.r, srgb.g, srgb.b].map((channel) => Math.round(channel * 255));
}

describe("landing OG image", () => {
  it("is a 1200 × 630 PNG on Paper's card background", async () => {
    const response = await landingImage();
    expect(response.headers.get("content-type")).toBe("image/png");
    const png = decodePng(new Uint8Array(await response.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1200, 630]);
    const corner = png.pixel(0, 0).slice(0, 3);
    paperBackground().forEach((channel, index) => {
      expect(Math.abs((corner[index] ?? -1) - channel), `channel ${String(index)}`).toBeLessThanOrEqual(2);
    });
  });
});

/** The centred column a subtitle may paint in: 560px wide on the 1200px card. */
const SUBTITLE_COLUMN = { left: 320, right: 880 } as const;

/** The subtitle's line height in the Paper design. */
const PAPER_LINE_HEIGHT = 72;

/** True when a pixel differs from the card background by more than 2/255 in any channel. */
function isInk(pixel: readonly number[], background: readonly number[]): boolean {
  return background.some((channel, index) => Math.abs((pixel[index] ?? -1) - channel) > 2);
}

/** A run of consecutive image rows that hold ink, as its first and last row. */
type InkBand = { readonly top: number; readonly bottom: number };

/** The horizontal bands of ink in an image, top to bottom. */
function inkBands(png: ReturnType<typeof decodePng>, background: readonly number[]): InkBand[] {
  const bands: InkBand[] = [];
  let top: number | undefined;
  // The loop runs one row past the image, which reads as blank and closes a band at the bottom edge.
  for (let y = 0; y <= png.height; y += 1) {
    let inked = false;
    for (let x = 0; y < png.height && x < png.width && !inked; x += 1) {
      inked = isInk(png.pixel(x, y), background);
    }
    if (inked && top === undefined) {
      top = y;
    } else if (!inked && top !== undefined) {
      bands.push({ top, bottom: y - 1 });
      top = undefined;
    }
  }
  return bands;
}

describe("OG card subtitle", () => {
  it("wraps a subtitle with no break opportunity onto two lines inside its 560px column", async () => {
    const mark = await loadElmeraMark();
    const response = await ogResponse(createElement(OgCard, { mark, subtitle: "W".repeat(19) }));
    const png = decodePng(new Uint8Array(await response.arrayBuffer()));
    const background = paperBackground();
    // The lockup sits inside the column too, so every row is checked, not only the subtitle's.
    const stray: string[] = [];
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        if (x >= SUBTITLE_COLUMN.left && x < SUBTITLE_COLUMN.right) {
          continue;
        }
        if (isInk(png.pixel(x, y), background)) {
          stray.push(`${String(x)},${String(y)}`);
        }
      }
    }
    expect(stray.slice(0, 5), `${String(stray.length)} pixels outside the column`).toEqual([]);

    // The first band from the top is the lockup; every band below it is a subtitle line.
    const [, ...lines] = inkBands(png, background);
    expect(lines, "subtitle lines below the lockup").toHaveLength(2);
    const [first, second] = lines;
    expect(Math.abs((second?.top ?? 0) - (first?.top ?? 0) - PAPER_LINE_HEIGHT)).toBeLessThanOrEqual(4);
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
