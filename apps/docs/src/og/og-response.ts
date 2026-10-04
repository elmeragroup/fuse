import type { ReactElement } from "react";

import { ImageResponse } from "next/og";

import { loadOgFonts } from "./og-assets";
import { OG_SIZE } from "./og-frame";

/**
 * Render an OG drawing to a 1200 × 630 PNG response with Roboto loaded. Each image renders per
 * request; a long cache header lets a CDN or the unfurler keep it, since a given URL only
 * changes with a deploy.
 *
 * @param element - The drawing, an `OgFrame` tree.
 * @returns The PNG response.
 */
export async function ogResponse(element: ReactElement): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: fonts.map((font) => ({ ...font })),
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
