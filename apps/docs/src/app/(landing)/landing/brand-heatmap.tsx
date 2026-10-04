"use client";

import { Suspense, useRef } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";

import { useHeat } from "./brand-heat";
import { DecorationBoundary } from "./decoration-boundary";
import { REDUCED_MOTION, useLandingTheme } from "./landing-theme";
import { useMediaQuery } from "./use-media-query";

// The shader is decoration that only draws on the client, so its code stays out of the server
// render and the first-load bundle.
const Heatmap = dynamic(async () => (await import("./heatmap-shader")).Heatmap, { ssr: false });

/**
 * The landing's one shader look, fixed by design: only the ramp, the surface and the mark
 * change per brand and scheme. The page uses it as decoration; Fuse does not ship it.
 */
const HEATMAP = {
  contour: 0.5,
  angle: 0,
  noise: 0.75,
  innerGlow: 0.3,
  outerGlow: 0.3,
  scale: 0.75,
  frame: 3000,
  minPixelRatio: 1,
} as const;

const SPEED = 0.5;

/**
 * The closing section's shader in the page's brand; the page background under it becomes its
 * back colour.
 */
export function BrandHeatmap(): ReactElement {
  const { brand } = useLandingTheme().theme;
  const host = useRef<HTMLDivElement>(null);
  const heat = useHeat(host);
  // Reduced motion holds the shader still on its first frame; the server renders it still too.
  const reduced = useMediaQuery(REDUCED_MOTION, true);

  return (
    <div ref={host} aria-hidden className="size-full">
      {heat === undefined || heat.colors.length === 0 ? null : (
        // Suspending caches the processed mark per image URL, so every tile and section that
        // shows a brand shares one pass instead of each blurring the same image again. A mark
        // that fails to load rejects that pass and throws here; the boundary drops the shader.
        <DecorationBoundary resetKey={brand}>
          <Suspense fallback={null}>
            <Heatmap
              className="size-full"
              image={`/landing/marks/${brand}.svg`}
              colors={heat.colors}
              colorBack={heat.back}
              speed={reduced ? 0 : SPEED}
              fit="contain"
              suspendWhenProcessingImage
              {...HEATMAP}
            />
          </Suspense>
        </DecorationBoundary>
      )}
    </div>
  );
}
