import type { ReactElement } from "react";

import { ImageResponse } from "next/og";

import { loadOgFonts } from "./og-assets";
import { OG_SIZE } from "./og-card";

/**
 * The fonts, read once per server process on first use. Every response passes this same array,
 * since Satori caches its parsed fonts by the array's identity.
 */
let fonts: ReturnType<typeof loadOgFonts> | undefined;

/**
 * Render an OG drawing to a 1200 × 630 PNG response with Roboto loaded. Every image prerenders
 * at build, and a long cache header lets a CDN or the unfurler keep it, since a given URL only
 * changes with a deploy.
 *
 * @param element - The drawing, an `OgCard`.
 * @returns The PNG response.
 */
export async function ogResponse(element: ReactElement): Promise<ImageResponse> {
  fonts ??= loadOgFonts();
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: await fonts,
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
